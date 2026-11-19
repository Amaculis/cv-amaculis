# cv-amaculis — interactive desk CV

A photorealistic 3D desk (Three.js) with a laptop and project files.

- **Laptop:** the camera flies into the screen and opens "Portfolio OS", with project windows, About and a small terminal.
- **Folder and printouts** on the desk: the featured projects. Click one to pick it up and read it.
- **Mug / business card:** About and contact.

## Edit content

Everything lives in [`src/data.ts`](src/data.ts):
- `profile`: name, role, links, skills
- `projects`: `onDesk: 'folder' | 'paper'` puts a project physically on the desk; the rest appear only in the laptop.

Project images go in `public/projects/`.

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # → dist/
```

## Deploy (GitHub Pages)

Push to `main`; `.github/workflows/deploy.yml` builds and publishes the site.
In the repo settings, set **Pages → Source: GitHub Actions**.

## Credits

Wood texture (`oak_veneer_01`) and HDRI (`brown_photostudio_02`) from [Poly Haven](https://polyhaven.com), CC0.
Hand model (`public/models/hand-right.glb`): the `generic-hand` profile from [webxr-input-profiles](https://github.com/immersive-web/webxr-input-profiles), MIT.
