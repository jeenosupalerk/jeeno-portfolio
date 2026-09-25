"""
Build looping "prototype walkthrough" clips from a slide of side-by-side phone
screenshots (the deck exports in assets/case-studies/).

What it does, per source slide:
  1. crops each phone loosely from the slide
  2. flood-fills the slide background away from the crop corners, so only the
     phone silhouette survives (the deck's two-tone background is baked into
     the JPEG and has to be masked out, not cropped out)
  3. finds the inner screen rectangle inside the bezel
  4. renders frames where the phone FRAME stays put and only the screen content
     slides — this is what makes it read as a real app push transition
  5. adds a tap ripple just before each transition
  6. encodes an .mp4 (used on the site) and optionally a .gif (for Behance/chat)

Usage:  python3 tools/build_flow_clip.py
Requires: Pillow, numpy, ffmpeg on PATH.

To add a new clip, append a build(...) call at the bottom. The two values you
have to find by hand for a new slide are `spans` (x ranges that bracket each
phone) and `yrange` (a y window that contains all of them). Find spans with:

    from PIL import Image; import numpy as np
    a = np.array(Image.open(SRC).convert('RGB')).astype(int)
    dark = (a[200:1600].mean(axis=2) < 110).mean(axis=0)   # bezel columns
    # print contiguous runs where dark > 0.55 -> left/right bezel of each phone

`taps` are (x, y) in 0..1 of the phone, one per screen, None for the last.
"""
from PIL import Image, ImageDraw, ImageFilter
import numpy as np, os, subprocess


def phone_mask(crop):
    w, h = crop.size
    work = crop.copy()
    for pt in [(1, 1), (w - 2, 1), (1, h - 2), (w - 2, h - 2), (w // 2, 1), (w // 2, h - 2)]:
        try:
            ImageDraw.floodfill(work, pt, (255, 0, 255), thresh=42)
        except Exception:
            pass
    a = np.array(work)
    outside = (a[:, :, 0] > 245) & (a[:, :, 1] < 12) & (a[:, :, 2] > 245)
    return Image.fromarray(((~outside) * 255).astype('uint8'), 'L')


def _first_run(vals, lo, hi, thr=170, need=14):
    step = 1 if hi > lo else -1
    i = lo
    while i != hi:
        seg = [vals[i + step * k] for k in range(need) if 0 <= i + step * k < len(vals)]
        if len(seg) == need and all(v > thr for v in seg):
            return i
        i += step
    return lo


def screen_rect(crop):
    a = np.array(crop).astype(int).mean(axis=2)
    h, w = a.shape
    r = h // 2
    sl = _first_run(a[r], 5, w - 5)
    sr = _first_run(a[r], w - 6, 5)
    cc = (sl + sr) // 2
    st = _first_run(a[:, cc], 5, h - 5)
    sb = _first_run(a[:, cc], h - 6, 5)
    return int(sl), int(st), int(sr), int(sb)


def ease(t):
    return 4 * t ** 3 if t < .5 else 1 - ((-2 * t + 2) ** 3) / 2


def build(src, spans, yrange, taps, out_stem, canvas, phone_h, bg,
          fps=15, hold=10, tapf=7, slide=7, tail=16, mp4_width=520, gif_width=None):
    im = Image.open(src).convert('RGB')
    y0, y1 = yrange

    loose, masks = [], []
    for x0, x1 in spans:
        c = im.crop((x0, y0, x1, y1))
        m = phone_mask(c)
        bb = m.getbbox()
        loose.append(c.crop(bb))
        masks.append(m.crop(bb))

    BW = min(p.size[0] for p in loose)
    BH = min(p.size[1] for p in loose)
    phones = [p.resize((BW, BH), Image.LANCZOS) for p in loose]
    masks = [m.resize((BW, BH), Image.LANCZOS) for m in masks]

    SX0, SY0, SX1, SY1 = screen_rect(phones[0])
    SW, SH = SX1 - SX0, SY1 - SY0
    contents = [p.crop((SX0, SY0, SX1, SY1)) for p in phones]
    smask = Image.new('L', (SW, SH), 0)
    ImageDraw.Draw(smask).rounded_rectangle([0, 0, SW - 1, SH - 1], radius=int(BW * 0.07), fill=255)
    print(f"{out_stem}: phone {BW}x{BH}  screen {SW}x{SH} at ({SX0},{SY0})")

    def phone_at(i, to=None, p=0.0):
        base = phones[i].copy()
        if to is not None:
            off = int(SW * p)
            vp = Image.new('RGB', (SW, SH), (255, 255, 255))
            vp.paste(contents[i], (-int(off * 0.30), 0))
            vp.paste(contents[to], (SW - off, 0))
            base.paste(vp, (SX0, SY0), smask)
        out = Image.new('RGBA', (BW, BH), (0, 0, 0, 0))
        out.paste(base, (0, 0), masks[i])
        return out

    CW, CH = canvas
    pw = int(round(BW * phone_h / BH))
    px, py = (CW - pw) // 2, (CH - phone_h) // 2
    shadow = Image.new('L', (CW, CH), 0)
    ImageDraw.Draw(shadow).rounded_rectangle(
        [px + 12, py + 22, px + pw - 12, py + phone_h + 8], radius=int(pw * 0.16), fill=110)
    shadow = shadow.filter(ImageFilter.GaussianBlur(int(pw * 0.09)))
    plate = Image.new('RGB', (CW, CH), bg)
    plate.paste(Image.new('RGB', (CW, CH), tuple(max(0, c - 46) for c in bg)), (0, 0), shadow)

    def frame(ph, tap=None, t=None):
        c = plate.copy()
        s = ph.resize((pw, phone_h), Image.LANCZOS)
        c.paste(s, (px, py), s)
        if tap and t is not None:
            ov = Image.new('RGBA', (CW, CH), (0, 0, 0, 0))
            d = ImageDraw.Draw(ov)
            cx, cy = px + tap[0] * pw, py + tap[1] * phone_h
            r = pw * 0.035 + pw * 0.10 * t
            a = int(150 * (1 - t))
            d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=(20, 20, 30, a), width=max(2, pw // 110))
            ri = pw * 0.038
            ai = int(190 * (1 - 0.35 * t))
            d.ellipse([cx - ri, cy - ri, cx + ri, cy + ri], fill=(255, 255, 255, ai),
                      outline=(20, 20, 30, ai), width=2)
            c = Image.alpha_composite(c.convert('RGBA'), ov).convert('RGB')
        return c

    frames = []
    for i in range(len(phones)):
        still = phone_at(i)
        for _ in range(hold):
            frames.append(frame(still))
        if taps[i] is not None:
            for k in range(tapf):
                frames.append(frame(still, taps[i], k / (tapf - 1)))
            for k in range(1, slide + 1):
                frames.append(frame(phone_at(i, i + 1, ease(k / (slide + 1)))))
        else:
            for _ in range(tail):
                frames.append(frame(still))

    d = f'/tmp/gifwork/out_{out_stem}'
    os.makedirs(d, exist_ok=True)
    for i, f in enumerate(frames):
        f.save(f'{d}/f{i:04d}.png')
    frames[0].save(f'/tmp/gifwork/{out_stem}-poster.jpg', quality=88)
    subprocess.run(['ffmpeg', '-y', '-framerate', str(fps), '-i', f'{d}/f%04d.png',
                    '-vf', f'scale={mp4_width}:-2:flags=lanczos', '-c:v', 'libx264',
                    '-pix_fmt', 'yuv420p', '-crf', '22', '-movflags', '+faststart',
                    f'/tmp/gifwork/{out_stem}.mp4'], check=True, capture_output=True)
    if gif_width:
        subprocess.run(['ffmpeg', '-y', '-framerate', str(fps), '-i', f'{d}/f%04d.png',
                        '-vf', f'scale={gif_width}:-2:flags=lanczos,split[a][b];'
                               '[a]palettegen=max_colors=160:stats_mode=diff[p];'
                               '[b][p]paletteuse=dither=bayer:bayer_scale=3',
                        '-loop', '0', f'/tmp/gifwork/{out_stem}.gif'], check=True, capture_output=True)
    print(f"  -> {len(frames)} frames, {len(frames)/fps:.1f}s")


if __name__ == '__main__':
    import sys
    ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    SHOTS = os.path.join(ROOT, 'assets', 'case-studies')

    # --- already shipped -----------------------------------------------------
    # Easy Parking · booking flow -> hero of work/easy-parking.html
    build(os.path.join(SHOTS, 'ep-ui-booking.jpg'),
          [(70, 741), (787, 1458), (1537, 2211), (2259, 2931)], (168, 1535),
          [(0.50, 0.33), (0.50, 0.78), (0.72, 0.945), None],
          'ep-flow', (520, 1000), 900, (244, 244, 241), gif_width=420)

    # Easy Parking · booking flow, 4:3 framing -> home-page card hover preview
    build(os.path.join(SHOTS, 'ep-ui-booking.jpg'),
          [(70, 741), (787, 1458), (1537, 2211), (2259, 2931)], (168, 1535),
          [(0.50, 0.33), (0.50, 0.78), (0.72, 0.945), None],
          'ep-card', (1200, 900), 760, (238, 238, 234), mp4_width=900)

    # Easy Parking · payment flow -> section 08 of work/easy-parking.html
    build(os.path.join(SHOTS, 'ep-ui-payment.jpg'),
          [(222, 982), (1111, 1881), (1997, 2757)], (80, 1620),
          [(0.50, 0.43), (0.50, 0.95), None],
          'ep-payment', (520, 1000), 900, (244, 244, 241), gif_width=420)

    # --- TODO: the other three case studies ---------------------------------
    # pos-screens.jpg / pos-mobile.jpg / pos-cash.jpg  (POS — desktop shots
    #   need a browser-chrome frame instead of a phone frame, so they need a
    #   variant of this script, not this one as-is)
    # contra-screens.jpg / contra-mobile.jpg           (Insurance)
    # ds-button.jpg / ds-input.jpg / ds-dropdown.jpg   (Design System — better
    #   served by a state cycle Default -> Hover -> Focus -> Disabled than by a
    #   screen-to-screen push)
    print("\nWrote clips to /tmp/gifwork/. Copy the .mp4 + -poster.jpg into "
          "assets/video/ and reference them from the HTML.")
