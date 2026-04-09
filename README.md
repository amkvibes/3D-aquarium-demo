# 3D Aquarium Demo

A WebGL-powered 3D aquarium set inside a house floor plan. Fish swim through furnished rooms filled with turquoise water, viewed from an isometric dollhouse perspective.

**[Live Demo](https://asifvibes.github.io/3D-aquarium-demo/)**

## About

This project renders a multi-room house layout as a transparent aquarium, with animated fish swimming through the rooms. Built entirely through vibe coding using Claude Code, with zero prior WebGL experience.

Fish assets are sourced from the open-source [WebGL Aquarium](https://webglsamples.org/aquarium/aquarium.html) project by Google and Human Engines (BSD-3-Clause license). The swimming animation replicates the original vertex shader that bends fish bodies along a sine wave for realistic movement.

## Features

- 200 colorful tropical fish across multiple species
- L-shaped house with 8+ furnished rooms and doorways
- Custom vertex shader ported from the original WebGL Aquarium
- Semi-transparent water volumes with animated surface
- Isometric camera with mouse orbit, zoom, and pan controls
- Responsive layout with loading screen

## Tech Stack

- Three.js for 3D rendering
- Vite for development and production builds
- Vanilla JavaScript
- GitHub Pages for deployment

## Local Development

```bash
git clone https://github.com/asifvibes/3D-aquarium-demo.git
cd 3D-aquarium-demo
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

## Credits

- Fish models and textures: [WebGL Aquarium](https://github.com/WebGLSamples/WebGLSamples.github.io/tree/master/aquarium) (BSD-3-Clause)
- Built with [Claude Code](https://docs.anthropic.com/en/docs/claude-code)

## License

MIT
