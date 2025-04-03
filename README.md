# Error Visualization for Quantum Information

![Quantum Error Visualization](quantum-error-viz.png)

This project provides an interactive visualization of error analysis in a quantum communication system. It models the probability density functions (PDFs) of two Gaussian-distributed signals (representing logical -1 and 1), computes the overlap area between them, and estimates error probabilities (bit flips) and erasure probabilities based on a configurable threshold.

## Features

- **Interactive Gaussian Curves:** Visualize two Gaussian PDFs corresponding to the two signal states.
- **Adjustable Parameters:**  
  - **σ (sigma)** and **amplitude** for each Gaussian curve can be tuned.  
  - A **threshold (τ)** parameter determines the separation between decision regions.
- **Visualization Modes:**  
  - **Baseline Mode:** Colors the overlapping area according to the curve that is dominant.
  - **Total Overlap Mode:** Highlights the entire overlapping region.
  - **Left/Right Modes:** Emphasize error regions not affected by the erasure as determined by the threshold.
- **Error Analysis:**  
  - **Bit Flip Probability (Pe):** Computed by integrating the PDF tail beyond the threshold.
  - **Erasure Probability (Pc):** Calculated by integrating the PDF within the threshold bounds.
- **Trackpad Navigation:**  
  - **Zoom:** Use Ctrl/Cmd + scroll (or a pinch gesture) to zoom in and out.
  - **Pan:** Scroll left/right to move across the x-axis.
  - **Slider Sensitivity:** Adjust slider sensitivity via a dropdown menu.

## Mathematical System Model & Notation

Below is the mathematical description and notation used in this project. This should help maintain consistency in notation if you plan to conduct a threshold analysis based on variance changes.

### 1. Gaussian Probability Density Functions

For the two signals, the Gaussian PDFs are defined as:

\[
f_{1}(x) = A_{1} \cdot \frac{1}{\sqrt{2\pi}\,\sigma_{1}} \exp\left(-\frac{(x - \mu_{1})^{2}}{2\sigma_{1}^{2}}\right)
\]

\[
f_{2}(x) = A_{2} \cdot \frac{1}{\sqrt{2\pi}\,\sigma_{2}} \exp\left(-\frac{(x - \mu_{2})^{2}}{2\sigma_{2}^{2}}\right)
\]

- **\(A_{1}, A_{2}\)**: Amplitudes for the two signals.  
- **\(\sigma_{1}, \sigma_{2}\)**: Standard deviations (variances) of the two signals.  
- **\(\mu_{1}\)** and **\(\mu_{2}\)**: Means of the signals. In our code, these are fixed at \(-1\) and \(1\) respectively.

### 2. Overlap Area Calculation

The overlapping area between the two PDFs is calculated as:

\[
\text{Overlap Area} = \int_{-\infty}^{\infty} \min\{ f_{1}(x),\, f_{2}(x) \} \, dx
\]

This integral is approximated numerically using the trapezoidal rule.

### 3. Error and Erasure Probabilities

The system distinguishes between two types of errors:

- **Bit Flip (Error) Probability (\(P_{e}\)):**  
  Represents the probability of misinterpreting a signal. For example:
  - For signal \(-1\), the bit flip error occurs when \(x \geq \tau\).  
  - For signal \(1\), the bit flip error occurs when \(x \leq -\tau\).

  Mathematically, this can be written as:
  
  \[
  P_{e} = \int_{\tau}^{\infty} f_{1}(x) \, dx + \int_{-\infty}^{- \tau} f_{2}(x) \, dx
  \]

- **Erasure Probability (\(P_{c}\)):**  
  Represents the probability that the received signal falls into an ambiguous region (erasure region) defined by the threshold:
  
  \[
  P_{c} = \int_{- \tau}^{\tau} f_{1}(x) \, dx + \int_{- \tau}^{\tau} f_{2}(x) \, dx
  \]

### 4. Notation Summary

- **\(x\):** Variable along the horizontal axis.
- **\(f_{1}(x)\), \(f_{2}(x)\):** Gaussian PDFs for signals \(-1\) and \(1\).
- **\(\sigma_{1}, \sigma_{2}\):** Standard deviations of the distributions.
- **\(A_{1}, A_{2}\):** Amplitudes (scaling factors) of the distributions.
- **\(\mu_{1}, \mu_{2}\):** Centers of the distributions (\(-1\) and \(1\)).
- **\(\tau\):** Threshold value for determining error regions.
- **Overlap Area:** Integral of the minimum of the two PDFs over all \(x\).
- **\(P_{e}\):** Bit flip error probability.
- **\(P_{c}\):** Erasure probability.

## Installation & Usage

1. **Clone the Repository:**

   ```bash
   git clone https://your.repo.url.git
   cd your-project-directory

2. **Install Dependencies:**

Make sure you have Node.js installed. Then run:

    '''bash
    Copy
    npm install
    
3. **Run the Development Server:**

    '''bash
    Copy
    npm run dev
    Open your browser and navigate to http://localhost:5000.
