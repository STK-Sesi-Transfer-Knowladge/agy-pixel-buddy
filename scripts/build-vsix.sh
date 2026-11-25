#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="$ROOT_DIR/dist"
STAGE_DIR="$DIST_DIR/.vsix-stage"
EXT_DIR="$STAGE_DIR/extension"
PUBLISHER="$(node -p "require('$ROOT_DIR/package.json').publisher")"
VERSION="$(node -p "require('$ROOT_DIR/package.json').version")"
VSIX_PATH="$DIST_DIR/agy-pixel-buddy-$VERSION.vsix"

rm -rf "$STAGE_DIR" "$VSIX_PATH"
mkdir -p "$EXT_DIR/src" "$EXT_DIR/media" "$EXT_DIR/hooks" "$EXT_DIR/companion"

cp "$ROOT_DIR/package.json" "$EXT_DIR/package.json"
cp "$ROOT_DIR/README.md" "$EXT_DIR/README.md"
cp "$ROOT_DIR/src/extension.js" "$EXT_DIR/src/extension.js"
cp "$ROOT_DIR/src/stateMapper.js" "$EXT_DIR/src/stateMapper.js"
cp "$ROOT_DIR/src/webviewHtml.js" "$EXT_DIR/src/webviewHtml.js"
cp "$ROOT_DIR/src/floatingLauncher.js" "$EXT_DIR/src/floatingLauncher.js"
cp "$ROOT_DIR/media/icon.png" "$EXT_DIR/media/icon.png"
cp "$ROOT_DIR/media/buddy-icon.svg" "$EXT_DIR/media/buddy-icon.svg"
cp "$ROOT_DIR/media/char-cat.gif" "$EXT_DIR/media/char-cat.gif"
cp "$ROOT_DIR/media/char-bot.gif" "$EXT_DIR/media/char-bot.gif"
cp "$ROOT_DIR/media/char-dev.gif" "$EXT_DIR/media/char-dev.gif"
cp "$ROOT_DIR/hooks/agy-buddy-hook.js" "$EXT_DIR/hooks/agy-buddy-hook.js"
cp "$ROOT_DIR/companion/floating_buddy.py" "$EXT_DIR/companion/floating_buddy.py"

cat > "$STAGE_DIR/[Content_Types].xml" << 'EOF'
<?xml version="1.0" encoding="utf-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension=".json" ContentType="application/json" />
  <Default Extension=".js" ContentType="application/javascript" />
  <Default Extension=".py" ContentType="text/x-python" />
  <Default Extension=".svg" ContentType="image/svg+xml" />
  <Default Extension=".png" ContentType="image/png" />
  <Default Extension=".gif" ContentType="image/gif" />
  <Default Extension=".md" ContentType="text/markdown" />
  <Default Extension=".vsixmanifest" ContentType="text/xml" />
</Types>
EOF

cat > "$STAGE_DIR/extension.vsixmanifest" << EOF
<?xml version="1.0" encoding="utf-8"?>
<PackageManifest Version="2.0.0" xmlns="http://schemas.microsoft.com/developer/vsx-schema/2011" xmlns:d="http://schemas.microsoft.com/developer/vsx-schema-design/2011">
  <Metadata>
    <Identity Language="en-US" Id="agy-pixel-buddy" Version="$VERSION" Publisher="$PUBLISHER" />
    <DisplayName>Agy Pixel Buddy</DisplayName>
    <Description xml:space="preserve">Animated pixel character buddy that reacts in real time when Antigravity AI is thinking, coding, reading, or running commands.</Description>
    <Categories>Other,Visualization</Categories>
    <Icon>extension/media/icon.png</Icon>
    <Properties>
      <Property Id="Microsoft.VisualStudio.Code.Engine" Value="^1.85.0" />
      <Property Id="Microsoft.VisualStudio.Code.ExtensionDependencies" Value="" />
      <Property Id="Microsoft.VisualStudio.Code.ExtensionPack" Value="" />
      <Property Id="Microsoft.VisualStudio.Code.ExtensionKind" Value="ui,workspace" />
    </Properties>
  </Metadata>
  <Installation>
    <InstallationTarget Id="Microsoft.VisualStudio.Code" Version="[1.85.0,)" />
  </Installation>
  <Dependencies />
  <Assets>
    <Asset Type="Microsoft.VisualStudio.Code.Manifest" Path="extension/package.json" Addressable="true" />
    <Asset Type="Microsoft.VisualStudio.Services.Content.Details" Path="extension/README.md" Addressable="true" />
    <Asset Type="Microsoft.VisualStudio.Services.Icons.Default" Path="extension/media/icon.png" Addressable="true" />
  </Assets>
</PackageManifest>
EOF

(cd "$STAGE_DIR" && zip -qr "$VSIX_PATH" .)
rm -rf "$STAGE_DIR"
echo "Built $VSIX_PATH"
