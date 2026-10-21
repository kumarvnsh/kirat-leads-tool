"""Render the supplied company logo into a macOS icon without changing its artwork."""
from pathlib import Path
import subprocess
import xml.etree.ElementTree as ET
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parent.parent
source=(root/'assets/kirat-logo.svg').read_text()
ET.register_namespace('', 'http://www.w3.org/2000/svg')
ET.register_namespace('xlink', 'http://www.w3.org/1999/xlink')
svg=ET.fromstring(source)
svg.set('viewBox','10 33 80 79');svg.set('width','768');svg.set('height','768')
svg_text=ET.tostring(svg,encoding='unicode')
folder=root/'.local/Kirat.iconset';folder.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
 b=p.chromium.launch(channel='chrome',headless=True)
 page=b.new_page(viewport={'width':1024,'height':1024},device_scale_factor=1)
 page.set_content('<html><body style="margin:0;background:transparent"><div style="width:1024px;height:1024px;border-radius:224px;background:#fffcf5;display:flex;align-items:center;justify-content:center">'+svg_text+'</div></body></html>')
 assert page.locator('svg').count()==1, 'Logo must render as SVG'
 page.screenshot(path=str(root/'assets/kirat-icon.png'),omit_background=True)
 assert (root/'assets/kirat-icon.png').stat().st_size>20000, 'Icon appears empty'
 b.close()
for size in (16,32,128,256,512):
 for scale in (1,2):
  name=f'icon_{size}x{size}'+('@2x' if scale==2 else '')+'.png'
  subprocess.run(['sips','-z',str(size*scale),str(size*scale),str(root/'assets/kirat-icon.png'),'--out',str(folder/name)],check=True,stdout=subprocess.DEVNULL)
subprocess.run(['iconutil','-c','icns',str(folder),'-o',str(root/'assets/Kirat.icns')],check=True)
