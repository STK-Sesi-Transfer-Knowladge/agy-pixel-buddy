#!/usr/bin/env python3
import json
import os
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PKG = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))

NAME = PKG["name"]
PUBLISHER = PKG["publisher"]
VERSION = PKG["version"]
DISPLAY_NAME = PKG["displayName"]
DESCRIPTION = PKG["description"]
OUT_VSIX = ROOT / f"{NAME}-{VERSION}.vsix"

CONTENT_TYPES_XML = """<?xml version="1.0" encoding="utf-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension=".json" ContentType="application/json" />
  <Default Extension=".js" ContentType="application/javascript" />
  <Default Extension=".py" ContentType="text/x-python" />
  <Default Extension=".svg" ContentType="image/svg+xml" />
  <Default Extension=".md" ContentType="text/markdown" />
  <Default Extension=".vsixmanifest" ContentType="text/xml" />
</Types>
"""

VSIX_MANIFEST = f"""<?xml version="1.0" encoding="utf-8"?>
<PackageManifest Version="2.0.0" xmlns="http://schemas.microsoft.com/developer/vsx-schema/2011">
  <Metadata>
    <Identity Language="en-US" Id="{NAME}" Version="{VERSION}" Publisher="{PUBLISHER}" />
    <DisplayName>{DISPLAY_NAME}</DisplayName>
    <Description xml:space="preserve">{DESCRIPTION}</Description>
    <Tags>pixel,animation,antigravity,buddy</Tags>
    <Categories>Other,Visualization</Categories>
    <GalleryFlags>Public</GalleryFlags>
  </Metadata>
  <Installation>
    <InstallationTarget Id="Microsoft.VisualStudio.Code" Version="[1.85.0,)" />
  </Installation>
  <Dependencies />
  <Assets>
    <Asset Type="Microsoft.VisualStudio.Code.Manifest" Path="extension/package.json" Addressable="true" />
  </Assets>
</PackageManifest>
"""

INCLUDE_FILES = [
    "package.json",
    "media/buddy-icon.svg",
    "src/extension.js",
    "src/stateMapper.js",
    "src/webviewHtml.js",
    "src/floatingLauncher.js",
    "hooks/agy-buddy-hook.js",
    "companion/floating_buddy.py",
]

with zipfile.ZipFile(OUT_VSIX, "w", compression=zipfile.ZIP_DEFLATED) as zf:
    zf.writestr("[Content_Types].xml", CONTENT_TYPES_XML.strip() + "\n")
    zf.writestr("extension.vsixmanifest", VSIX_MANIFEST.strip() + "\n")
    for rel in INCLUDE_FILES:
        src = ROOT / rel
        zf.write(src, f"extension/{rel}")

print(f"Built {OUT_VSIX}")
