# Enemy animation frames

Put 56×56 PNG frames in the matching action folder. Use this filename pattern:

- `design/Animation/enemies/move/slime_blue_1.png`
- `design/Animation/enemies/move/slime_blue_2.png`
- `design/Animation/enemies/attack/slime_blue_1.png`

The numeric suffix determines playback order. After adding, removing, or renaming frames, run this in PowerShell from the repository root:

```powershell
.\tools\build-animation-manifest.ps1
```

It refreshes the manifest and copies the frame images into `dist` for publishing. Both the battle and animation preview read the same manifest. Node.js is not required.

Frames are looped in ascending numeric order. Use consecutive numbers starting at 1 and keep each frame canvas 56×56.
