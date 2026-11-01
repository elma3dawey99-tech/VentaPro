# VentaPro – desktop app

Mechanical Ventilation Simulator for the Emergency & Critical Care Technology (ECC) Department, Delta University for Science and Technology.
**Designed by Youssef Mahrous Elmaadawy.**

This repository holds the Windows desktop shell that the lab PCs install. The simulator itself (student and instructor views, ventilator, monitor, ABG) runs online, so most changes reach every PC without touching this repository.

## How updates reach the lab PCs
| What changed | Where it is changed | Reinstall? |
|---|---|---|
| Simulator, cases, instructor page, startup screen, colours | Online web app (Apps Script) | No – live on the next start |
| The desktop app itself (icon, window behaviour, Electron) | This repository → new GitHub Release | No – downloads in the background and installs when the app is closed |

## Releasing a new desktop version
1. Change the code and bump `version` in `package.json` (for example 1.3.0 → 1.3.1).
2. Commit and push a tag with the same number: `git tag v1.3.1 && git push --tags`.
3. GitHub Actions builds `VentaPro-Setup-<version>.exe` and publishes the release.
4. Every installed VentaPro finds it within a few hours (or on its next start), downloads it, and installs it when closed.

Installs go to `C:\VentSim` (kept from the first version so updates install over the same folder).
