import re
from pathlib import Path

path = Path(__file__).parent / "components" / "CseDocCheckApp.tsx"
text = path.read_text(encoding="utf-8")

# Remove temp markers
for m in ("__DUPLICATE__", "__DEL_MAESTRANZE__", "__DEL_CHECKLIST__", "__ORPHAN_START__",
          "__ORPHAN_BLOCK_START__", "__DELETE_CHECKLIST__", "__ORPHAN1__", "__ORPHAN_BLOCK__",
          "__ORPHAN_LINE_TO_DELETE", "ORPHAN_LINE_TO_DELETE", "__END_MAESTRANZE__", "__ORPHAN__"):
    text = text.replace(m, "")

# Keep only ImpresaPage + showAddMaestra modal in impresa fragment
pattern = re.compile(
    r"(<ImpresaPage\b[\s\S]*?\n\s*/>\n)([\s\S]*?)(\n\s*\{showAddMaestra\s*&&\s*<Modal)",
    re.MULTILINE,
)
text, n = pattern.subn(lambda m: m.group(1) + m.group(3), text, count=1)
if n != 1:
    raise SystemExit(f"Expected 1 impresa replacement, got {n}")

lines = text.splitlines(keepends=True)
out = []
for line in lines:
    if "{showAddMaestra &&" in line and "Modal" in line:
        k = line.find("{showAddMaestra &&")
        line = "        {showAddMaestra &&" + line[k + len("{showAddMaestra &&") :]
    out.append(line)

path.write_text("".join(out), encoding="utf-8", newline="")
print("Fixed impresa block.")
for i in range(251, 311):
    if i <= len(out):
        print(f"{i:4}|{out[i-1].rstrip()}")
