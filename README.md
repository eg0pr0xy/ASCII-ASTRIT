<<<<<<< HEAD
# ░▒▓ ASCII ASTRIT ▓▒░
### The Hyper-Modern PICO-8 ASCII Engine

![License](https://img.shields.io/badge/license-MIT-ff004d.svg)
![Version](https://img.shields.io/badge/version-3.5.0-29adff.svg)
![Stack](https://img.shields.io/badge/tech-REACT_CANVAS_TS-00e436.svg)

**ASCII ASTRIT** is a professional-grade generative art studio that converts visual media into semantic text art and technical indexes. It bridges the gap between retro PICO-8 aesthetics and high-fidelity print output, utilizing a stateful rendering engine with physics-based distortion, Sobel edge detection, and professional-grade export capabilities.

---

## 🏗️ Architecture Overview

The application is structured for high-performance pixel manipulation and memory-efficient exporting:
1.  **State Layer (`App.tsx`)**: Centralized `EngineConfig` management, theme synchronization, and media lifecycle.
2.  **Rendering Core (`services/asciiEngine.ts`)**: A high-speed Canvas-based engine performing real-time luminance analysis, error diffusion, and Sobel edge filtering.
3.  **UI/UX Layer (`components/`)**: A "Hardware-Modular" interface built with Tailwind CSS and Lucide icons.

---

## 🔧 Core Services

### `AsciiEngine` (`services/asciiEngine.ts`)
The core processing unit. It operates directly on the Canvas 2D Context, optimized for both real-time preview and high-resolution static rendering.

**Advanced Processing Pipeline:**
*   **Sobel Edge Detection**: When `outlineEnabled` is active, the engine performs a 3x3 Sobel convolution on the luminance buffer. It calculates gradient magnitude and angle to map edges to specific directional characters (`|`, `/`, `-`, `\`) and applies a dedicated `outlineColor`.
*   **Luminance & Dithering**: 
    *   **Bayer (Ordered)**: Deterministic noise based on a 4x4 matrix.
    *   **Floyd-Steinberg (Error Diffusion)**: O(N) CPU-based diffusion for smooth gradients.
*   **Cultural & Specialist Ramps**: Curated charsets for:
    *   `ARABIC`: Calligraphic connections and ornamental density.
    *   `HEBREW`: Mystical/numerical character weightings.
    *   `ZEUS`: Mathematical and Greek scientific notation.

### `Export Pipeline` (Professional Output)
The engine now supports professional print-ready workflows.
*   **Orientation-Aware Scaling**: Detects source aspect ratio (Portrait/Landscape) and automatically rotates target paper sizes (A4, A3, A2) to minimize white space and maximize pixel density.
*   **Variation Index (Contact Sheets)**: Generates a master A2-sized index sheet of all available `AsciiMode` variants, including technical metadata stamps (timestamps, resolution, mode IDs).
*   **Memory Efficiency**: Implements buffer pooling and safety clamping (8K dimension limits) to prevent browser context loss during high-DPI (300+) renders.

---

## 🧩 Component Documentation

### `AsciiCanvas.tsx`
The interactive viewport.
*   **Zoom/Pan Engine**: Supports infinite panning and 8x zoom using hardware-accelerated CSS transforms.
*   **Live Compositing**: Composites the main source with a hidden `brushLayer` for real-time drawing and glitch-painting.

### `Mascot.tsx` (ASTRIT Companion)
An interactive state-machine entity.
*   **Eye Tracking**: Dynamically calculates "lean" angles based on global cursor position.
*   **States**: `IDLE` -> `HAPPY` -> `SLEEP` -> `SURPRISED` -> `DRAGGING`.

---

## 🎛️ Configuration & Types

### `EngineConfig` (Extended)
```typescript
interface EngineConfig {
  outlineEnabled: boolean;      // Sobel filter toggle
  outlineSensitivity: number;  // Edge threshold
  outlineColor: string;        // Hex override for edges
  ditheringMode: DitheringMode; // NONE, BAYER, FLOYD
  transparentBackground: boolean; // Alpha-channel export support
  // ... (Full grading & distortion suite)
}
```

---

## 🚀 Installation & Setup

1.  **Install Dependencies**:
    ```bash
    npm install
    ```
2.  **Start Studio**:
    ```bash
    npm run dev
    ```

---

## ⚠️ Performance Considerations
*   **Sobel Convolution**: Edge detection adds an extra pass over the luminance buffer. High-resolution source images with low character scales may require significant CPU overhead.
*   **Export Times**: A2 300-DPI exports generate massive blobs (~10MB+). Do not close the browser tab until the "GENERATING MASTER" overlay disappears.

---
**DEVELOPED BY NEUE EPISTEME STUDIO // V3.5 "SOBEL UPDATE"**
=======
# ASCII-ASTRIT
>>>>>>> origin/main
