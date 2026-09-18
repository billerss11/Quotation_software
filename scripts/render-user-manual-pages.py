"""Rasterize a Microsoft Word-exported PDF using the document skill's renderer."""
import argparse
import importlib.util
import os
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('document', type=Path)
parser.add_argument('pdf', type=Path)
parser.add_argument('output_dir', type=Path)
parser.add_argument('--renderer', type=Path, required=True)
parser.add_argument('--poppler-bin', type=Path, required=True)
args = parser.parse_args()
assert args.pdf.is_file(), args.pdf
os.environ['PATH'] = str(args.poppler_bin.resolve()) + os.pathsep + os.environ.get('PATH', '')
spec = importlib.util.spec_from_file_location('document_renderer', args.renderer)
renderer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(renderer)
# Microsoft Word has already refreshed the native TOC and exported the authoritative PDF.
# Reuse render_docx.py's PNG rendering and naming without invoking another office suite.
renderer.convert_to_pdf = lambda *unused, **options: (str(args.pdf.resolve()), 'Exported by Microsoft Word')
pages = renderer.rasterize(str(args.document), str(args.output_dir), 144, False, False)
print(f'Rendered {len(pages)} pages to {args.output_dir}')
