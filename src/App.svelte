<script>
  import { onMount } from 'svelte';
  import Plotly from 'plotly.js-dist-min';

  let sigma1 = 1;
  let sigma2 = 1;
  let amplitude1 = 1;
  let amplitude2 = 1;
  let overlapArea = 0;
  let plotDiv;
  let stepSize = 0.1; // Default step size for both sigma & amplitude

  let xStart = -5; // Initial x-axis range
  let xEnd = 5;

  // Gaussian PDF function
  function gaussian(x, center, sigma, amplitude) {
    return amplitude * (1 / (Math.sqrt(2 * Math.PI) * sigma)) * Math.exp(-((x - center) ** 2) / (2 * sigma * sigma));
  }

  // Function to update the plot and compute the overlap area
  function updatePlot() {
    if (!plotDiv) return;

    const xValues = [];
    const f1Values = [];
    const f2Values = [];
    const minValues = [];
    const step = 0.01;

    for (let x = xStart; x <= xEnd; x += step) {
      xValues.push(x);
      const f1 = gaussian(x, -1, sigma1, amplitude1);
      const f2 = gaussian(x, 1, sigma2, amplitude2);
      f1Values.push(f1);
      f2Values.push(f2);
      minValues.push(Math.min(f1, f2));
    }

    // Numerical integration using the trapezoidal rule
    let integral = 0;
    for (let i = 0; i < minValues.length - 1; i++) {
      integral += (minValues[i] + minValues[i + 1]) * step / 2;
    }
    overlapArea = integral;

    // Define traces for the two Gaussians and the overlap area
    const trace1 = {
      x: xValues,
      y: f1Values,
      mode: 'lines',
      name: 'Signal -1',
      line: { color: '#4287f5', width: 2.5 }  // Brighter blue for better visibility
    };

    const trace2 = {
      x: xValues,
      y: f2Values,
      mode: 'lines',
      name: 'Signal 1',
      line: { color: '#f54242', width: 2.5 }  // Brighter red for better visibility
    };

    const traceOverlap = {
      x: xValues,
      y: minValues,
      mode: 'lines',
      name: 'Overlap',
      fill: 'tozeroy',
      fillcolor: 'rgba(46, 204, 113, 0.3)',
      line: { color: '#2ecc71', width: 2 }
    };

    // Vertical dotted lines at x = -1 and x = 1
    const centerLine1 = {
      x: [-1, -1],
      y: [0, Math.max(...f1Values)],
      mode: 'lines',
      name: 'Center of Signal -1',
      line: { color: '#4287f5', dash: 'dot', width: 1.5 }
    };

    const centerLine2 = {
      x: [1, 1],
      y: [0, Math.max(...f2Values)],
      mode: 'lines',
      name: 'Center of Signal 1',
      line: { color: '#f54242', dash: 'dot', width: 1.5 }
    };

    const data = [trace1, trace2, traceOverlap, centerLine1, centerLine2];

    const layout = {
      title: 'Gaussian Distributions and Overlap',
      xaxis: {
        title: 'x',
        dtick: 1,
        tickmode: 'linear',
        range: [xStart, xEnd],
        gridcolor: 'rgba(255, 255, 255, 0.1)',
        zerolinecolor: 'rgba(255, 255, 255, 0.2)'
      },
      yaxis: { 
        title: 'Probability Density',
        gridcolor: 'rgba(255, 255, 255, 0.1)',
        zerolinecolor: 'rgba(255, 255, 255, 0.2)'
      },
      showlegend: true,
      margin: { t: 50, l: 50, r: 50, b: 50 },
      // These properties create the glass effect background
      paper_bgcolor: 'rgba(255, 255, 255, 0.05)',
      plot_bgcolor: 'rgba(255, 255, 255, 0.02)',
      font: {
        color: 'rgba(255, 255, 255, 0.9)',
        size: 12
      },
      legend: {
        bgcolor: 'rgba(255, 255, 255, 0.1)',
        bordercolor: 'rgba(255, 255, 255, 0.2)',
        borderwidth: 1
      }
    };

    const config = {
      responsive: true,
      displayModeBar: true,
      modeBarButtonsToRemove: ['select2d', 'lasso2d'] // Simplify the toolbar
    };

    Plotly.react(plotDiv, data, layout, config);
  }

  onMount(() => {
    updatePlot();
    plotDiv.addEventListener("wheel", handleTrackpadScroll);
    // Add mouse move event to track mouse position
    plotDiv.addEventListener("mousemove", trackMousePosition);
  });

  // Track mouse position for zooming
  let lastMouseX = 0;
  let lastMouseY = 0;

  function trackMousePosition(event) {
    // Store normalized mouse position (0-1) within the plot
    lastMouseX = event.offsetX / plotDiv.clientWidth;
    lastMouseY = event.offsetY / plotDiv.clientHeight;
  }

  function handleTrackpadScroll(event) {
    event.preventDefault();

    // Calculate the x position within the plot coordinates
    const mouseX = lastMouseX * (xEnd - xStart) + xStart;
    
    if (event.ctrlKey || event.metaKey) {
      // Zooming (CTRL/CMD + Scroll)
      // Simple zoom logic with balanced in/out speed
      if (event.deltaY > 0) {
        // Zoom out - expand the view
        const zoomScale = 1.05;
        const distFromLeft = mouseX - xStart;
        const distFromRight = xEnd - mouseX;
        
        xStart = mouseX - distFromLeft * zoomScale;
        xEnd = mouseX + distFromRight * zoomScale;
      } else {
        // Zoom in - narrow the view
        const zoomScale = 0.95;
        const distFromLeft = mouseX - xStart;
        const distFromRight = xEnd - mouseX;
        
        xStart = mouseX - distFromLeft * zoomScale;
        xEnd = mouseX + distFromRight * zoomScale;
      }
    } else {
      // Panning - delta represents the scroll amount
      const rangeSize = xEnd - xStart;
      const panAmount = rangeSize * 0.01; 
      
      // Pan left or right based on deltaX if available, otherwise use deltaY
      const delta = event.deltaX || event.deltaY;
      const direction = delta > 0 ? 1 : -1;
      
      xStart += direction * panAmount;
      xEnd += direction * panAmount;
    }

    updatePlot();
  }

  function validateSigma1(event) {
    sigma1 = Math.min(5, Math.max(0.1, parseFloat(event.target.value) || 1));
    updatePlot();
  }

  function validateSigma2(event) {
    sigma2 = Math.min(5, Math.max(0.1, parseFloat(event.target.value) || 1));
    updatePlot();
  }

  function validateAmplitude1(event) {
    amplitude1 = Math.min(5, Math.max(0.1, parseFloat(event.target.value) || 1));
    updatePlot();
  }

  function validateAmplitude2(event) {
    amplitude2 = Math.min(5, Math.max(0.1, parseFloat(event.target.value) || 1));
    updatePlot();
  }
  
  // Function to handle trackpad gestures on sliders
  function handleSliderWheel(event, sliderType) {
    event.preventDefault();
    
    // Determine direction from wheel event
    const delta = event.deltaX || event.deltaY;
    const direction = delta > 0 ? -1 : 1; // -1 to decrease, 1 to increase
    
    // Get the exact step size from the dropdown
    const currentStepSize = parseFloat(stepSize);
    
    // Apply different adjustment factors based on step size
    let adjustmentFactor;
    if (currentStepSize >= 1) {
      // Much slower adjustment for whole numbers
      adjustmentFactor = 0.51; // Only 1/10 of step size per scroll event for whole numbers
    } else {
      // Standard adjustment for decimal values
      adjustmentFactor = 0.8; // 1/5 of step size per scroll event for decimals
    }
    
    const adjustmentAmount = currentStepSize * adjustmentFactor;
    
    // Apply changes based on slider type
    switch(sliderType) {
      case 'sigma1':
        sigma1 = Math.min(5, Math.max(0.1, sigma1 + direction * adjustmentAmount));
        // Round to appropriate decimal places based on step size
        sigma1 = roundToStepPrecision(sigma1, currentStepSize);
        validateSigma1({ target: { value: sigma1 } });
        break;
      case 'sigma2':
        sigma2 = Math.min(5, Math.max(0.1, sigma2 + direction * adjustmentAmount));
        sigma2 = roundToStepPrecision(sigma2, currentStepSize);
        validateSigma2({ target: { value: sigma2 } });
        break;
      case 'amplitude1':
        amplitude1 = Math.min(5, Math.max(0.1, amplitude1 + direction * adjustmentAmount));
        amplitude1 = roundToStepPrecision(amplitude1, currentStepSize);
        validateAmplitude1({ target: { value: amplitude1 } });
        break;
      case 'amplitude2':
        amplitude2 = Math.min(5, Math.max(0.1, amplitude2 + direction * adjustmentAmount));
        amplitude2 = roundToStepPrecision(amplitude2, currentStepSize);
        validateAmplitude2({ target: { value: amplitude2 } });
        break;
    }
  }
  
  // Helper function to round a value to precision matching the step size
  function roundToStepPrecision(value, stepSize) {
    // Determine number of decimal places in step size
    const stepStr = stepSize.toString();
    const decimalPlaces = stepStr.includes('.') ? 
                          stepStr.split('.')[1].length : 
                          0;
    
    // Round to that many decimal places
    const multiplier = Math.pow(10, decimalPlaces);
    return Math.round(value * multiplier) / multiplier;
  }
</script>

<div class="container">
  <h1>Error Visualization for Quantum Information</h1>

  <div class="sensitivity-container">
    <label>
      Adjust Slider Sensitivity:
      <select bind:value={stepSize}>
        <option value="1">Whole Number</option>
        <option value="0.1">1 Decimal (0.1)</option>
        <option value="0.01">2 Decimals (0.01)</option>
      </select>
    </label>
  </div>

  <div class="slider-container">
    <div class="slider-row">
      <label>
        σ (sigma) 1:
        <input type="number" min="0.1" max="5" step={stepSize} bind:value={sigma1} on:input={validateSigma1} />
        <div class="slider-wrapper" on:wheel={e => handleSliderWheel(e, 'sigma1')}>
          <input type="range" min="0.1" max="5" step={stepSize} bind:value={sigma1} on:input={updatePlot} />
        </div>
      </label>
      <label>
        Amplitude 1:
        <input type="number" min="0.1" max="5" step={stepSize} bind:value={amplitude1} on:input={validateAmplitude1} />
        <div class="slider-wrapper" on:wheel={e => handleSliderWheel(e, 'amplitude1')}>
          <input type="range" min="0.1" max="5" step={stepSize} bind:value={amplitude1} on:input={updatePlot} />
        </div>
      </label>
    </div>

    <div class="slider-row">
      <label>
        σ (sigma) 2:
        <input type="number" min="0.1" max="5" step={stepSize} bind:value={sigma2} on:input={validateSigma2} />
        <div class="slider-wrapper" on:wheel={e => handleSliderWheel(e, 'sigma2')}>
          <input type="range" min="0.1" max="5" step={stepSize} bind:value={sigma2} on:input={updatePlot} />
        </div>
      </label>
      <label>
        Amplitude 2:
        <input type="number" min="0.1" max="5" step={stepSize} bind:value={amplitude2} on:input={validateAmplitude2} />
        <div class="slider-wrapper" on:wheel={e => handleSliderWheel(e, 'amplitude2')}>
          <input type="range" min="0.1" max="5" step={stepSize} bind:value={amplitude2} on:input={updatePlot} />
        </div>
      </label>
    </div>
  </div>

  <div bind:this={plotDiv} class="plot-container"></div>

  <h2>Current Visible Overlap Area: {overlapArea.toFixed(4)}</h2>
  
  <div class="instructions">
    <p><strong>Trackpad Navigation:</strong></p>
    <ul>
      <li>Zoom: Ctrl/Cmd + Scroll OR Zoom Motion (centered on mouse position)</li>
      <li>Pan: Scroll left/right</li>
      <li>Adjust sliders: Hover over a slider and scroll/swipe</li>
    </ul>
  </div>
</div>
