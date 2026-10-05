# Film emulation CLUT credits

The HaldCLUT PNG files in this folder are from the Natron CLUT collection
(https://github.com/NatronGitHub/clut), which bundles the RawTherapee Film
Simulation Collection and community-contributed film emulation profiles.

- License: Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)
- Authors: Pat David, Pavlov Dmitry, Michael Ezra, and community contributors
- Upstream: https://rawpedia.rawtherapee.com/Film_Simulation

Film stock names (Kodak Portra, Kodachrome, Fuji Velvia, Ilford HP5, etc.)
are used for identification only. The CLUT authors and this project are not
affiliated with or endorsed by the trademark owners.

## Film Collection additions (2026-10-05)

Six new HaldCLUT profiles by **Pat David**, sourced from
[NatronGitHub/clut at af7b50d4caf6244fb6895a647f5b6a84efe7931a](https://github.com/NatronGitHub/clut/tree/af7b50d4caf6244fb6895a647f5b6a84efe7931a).
These approximate film color responses; they are not manufacturer-supplied LUTs,
measured guarantees, or endorsements. Grain and optical effects are separate.

| App label / file | Original upstream file |
| --- | --- |
| FUJI 160C / `fuji160c.png` | `negative_new/fuji_160c.png` |
| SUPERIA 400 / `superia400.png` | `negative_old/fuji_superia_400.png` |
| ULTRA COLOR 100 / `ultra100.png` | `negative_color/agfa_ultra_color_100.png` |
| ELITE CHROME 200 / `elite200.png` | `colorslide/kodak_elite_chrome_200.png` |
| INSTANT 690 / `instant690.png` | `instant_pro/polaroid_690.png` |
| NEOPAN 1600 / `neopan1600.png` | `bw/fuji_neopan_1600.png` |

- License: [Creative Commons Attribution-ShareAlike 4.0 International](https://creativecommons.org/licenses/by-sa/4.0/).
- License declaration: [upstream README at the pinned revision](https://github.com/NatronGitHub/clut/blob/af7b50d4caf6244fb6895a647f5b6a84efe7931a/README.md).
- Author's original work: [Film emulation presets](https://patdavid.net/2013/08/film-emulation-presets-in-gmic-gimp/).
- Changes: local filenames/display labels and embedded origin metadata only;
  lookup pixels, 512×512 Hald layout, and color response remain unchanged.
  These redistributed LUT assets remain available under CC BY-SA 4.0.
- New assets have distinct contents from the existing 20 film PNGs. Existing
  assets, preset IDs and render parameters are unchanged.
