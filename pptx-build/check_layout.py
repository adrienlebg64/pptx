import sys
from pptx import Presentation
from pptx.util import Emu

EMU_PER_INCH = 914400
SLIDE_W = 13.333
SLIDE_H = 7.5

def to_in(emu):
    return emu / EMU_PER_INCH

path = sys.argv[1] if len(sys.argv) > 1 else "/home/user/pptx/TimeEats_Portefeuille_DSI.pptx"
prs = Presentation(path)

issues = []

for si, slide in enumerate(prs.slides, start=1):
    boxes = []
    for shape in slide.shapes:
        if shape.left is None or shape.top is None:
            continue
        x, y, w, h = to_in(shape.left), to_in(shape.top), to_in(shape.width), to_in(shape.height)
        label = shape.shape_type
        text = ""
        if shape.has_text_frame:
            text = shape.text_frame.text[:40].replace("\n", " | ")
        elif shape.has_table:
            text = "[TABLE]"
            # pptxgenjs writes a nominal frame height that does NOT match the
            # actual rendered height (sum of row heights) — use the real sum.
            h = sum(to_in(row.height) for row in shape.table.rows)
        boxes.append((x, y, w, h, label, text))
        # bounds check
        if x < -0.02 or y < -0.02 or (x + w) > SLIDE_W + 0.02 or (y + h) > SLIDE_H + 0.02:
            issues.append(f"Slide {si}: OUT OF BOUNDS  x={x:.2f} y={y:.2f} w={w:.2f} h={h:.2f} bottom={y+h:.2f} right={x+w:.2f}  '{text}'")

    # overlap check: only flag text/table boxes overlapping vertically AND horizontally
    # by more than a small tolerance, ignoring intentional decorative overlaps (dots/panel).
    def is_decor(label, text):
        return text == "" and label in (13, )  # freeform/autoshape w/o text often decorative

    n = len(boxes)
    for i in range(n):
        for j in range(i + 1, n):
            x1, y1, w1, h1, l1, t1 = boxes[i]
            x2, y2, w2, h2, l2, t2 = boxes[j]
            if not t1 or not t2:
                continue  # skip decorative shapes with no text
            # horizontal overlap
            hx = min(x1 + w1, x2 + w2) - max(x1, x2)
            hy = min(y1 + h1, y2 + h2) - max(y1, y2)
            if hx > 0.15 and hy > 0.08:
                issues.append(
                    f"Slide {si}: OVERLAP  '{t1}' [{x1:.2f},{y1:.2f},{w1:.2f}x{h1:.2f}]  <->  '{t2}' [{x2:.2f},{y2:.2f},{w2:.2f}x{h2:.2f}]  overlap={hx:.2f}x{hy:.2f}"
                )

if issues:
    print(f"{len(issues)} issue(s) found:\n")
    for i in issues:
        print(" -", i)
else:
    print("No bounds/overlap issues found.")
