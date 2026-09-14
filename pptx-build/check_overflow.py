import sys
from pptx import Presentation
from pptx.util import Emu, Pt

EMU_PER_INCH = 914400

def to_in(emu):
    return emu / EMU_PER_INCH

# Empirical average character width as a fraction of font size (points),
# for Arial regular/bold at typical mixed-case French text.
AVG_CHAR_WIDTH_FACTOR = 0.52

path = sys.argv[1] if len(sys.argv) > 1 else "/home/user/pptx/TimeEats_Portefeuille_DSI.pptx"
prs = Presentation(path)

flags = []

for si, slide in enumerate(prs.slides, start=1):
    for shape in slide.shapes:
        if not getattr(shape, "has_text_frame", False):
            continue
        tf = shape.text_frame
        if not tf.text.strip():
            continue
        box_w_in = to_in(shape.width)
        box_h_in = to_in(shape.height)
        total_lines = 0.0
        for para in tf.paragraphs:
            runs = para.runs
            if not runs:
                if para.text.strip() == "":
                    total_lines += 1
                continue
            # find dominant font size in this paragraph
            sizes = [r.font.size.pt for r in runs if r.font.size]
            fsize = sizes[0] if sizes else 12
            text = "".join(r.text for r in runs)
            if text == "":
                total_lines += 1
                continue
            char_w_in = fsize * AVG_CHAR_WIDTH_FACTOR / 72.0
            chars_per_line = max(1, int(box_w_in / char_w_in))
            para_lines = max(1, -(-len(text) // chars_per_line))  # ceil
            total_lines += para_lines
        if total_lines == 0:
            continue
        # dominant size for line-height estimate: use first run's size across all paragraphs
        first_size = None
        for para in tf.paragraphs:
            for r in para.runs:
                if r.font.size:
                    first_size = r.font.size.pt
                    break
            if first_size:
                break
        first_size = first_size or 12
        line_h_in = first_size * 1.32 / 72.0
        needed_h = total_lines * line_h_in
        if needed_h > box_h_in * 1.08:  # 8% tolerance
            preview = tf.text[:55].replace("\n", " | ")
            flags.append(
                f"Slide {si}: possible overflow — box {box_w_in:.2f}x{box_h_in:.2f}in, "
                f"est. {total_lines:.0f} line(s) @ {first_size:.0f}pt needing ~{needed_h:.2f}in  '{preview}'"
            )

if flags:
    print(f"{len(flags)} potential overflow(s):\n")
    for f in flags:
        print(" -", f)
else:
    print("No potential text overflow detected.")
