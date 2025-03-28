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
  let threshold = 0; // Default threshold value (tau)
  let overlapMode = "baseline"; // Default to baseline mode
  let errorProbability = 0; // Pe - bit flip probability
  let erasureProbability = 0; // Pc - erasure probability
  let showNegativeTauErasure = false;
  
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
    const leftOfThresholdValues = [];
    const rightOfThresholdValues = [];
    const f1ErrorValues = []; // For f1 in error region (bit flips when signal -1 is detected as 1)
    const f2ErrorValues = []; // For f2 in error region (bit flips when signal 1 is detected as -1)
    const f1ErasureValues = []; // For f1 in erasure region
    const f2ErasureValues = []; // For f2 in erasure region
    const f1DirectValues = []; // For direct coloring in baseline mode
    const f2DirectValues = []; // For direct coloring in baseline mode
    const erasureRegionValues = []; // For green erasure region
    const step = 0.01;
  
    const negThreshold = -threshold;
  
    // Compute values across the x-range
    for (let x = xStart; x <= xEnd; x += step) {
      xValues.push(x);
      const f1 = gaussian(x, -1, sigma1, amplitude1);
      const f2 = gaussian(x, 1, sigma2, amplitude2);
      f1Values.push(f1);
      f2Values.push(f2);
      
      // Min for total overlap
      const minVal = Math.min(f1, f2);
      minValues.push(minVal);
      
      // For baseline mode - only color the overlap areas with the color of the curve above
      // We need to identify where curves overlap and which one is on top
      const f1IsAbove = f1 > f2;
      const f2IsAbove = f2 > f1;
      const overlap = f1 > 0 && f2 > 0; // Both curves exist at this point
      
      // For baseline mode, we only want to color where both curves exist
      // and use the color of the curve that's directly above
      f1DirectValues.push(overlap && f2IsAbove ? Math.min(f1, f2) : 0); // Blue where f2 is above
      f2DirectValues.push(overlap && f1IsAbove ? Math.min(f1, f2) : 0); // Red where f1 is above
      
      // For visualization modes with thresholds
      leftOfThresholdValues.push(x <= threshold ? minVal : 0);
      rightOfThresholdValues.push(x >= threshold ? minVal : 0);
      
      // For error regions based on overlap mode
      if (overlapMode === "left" || overlapMode === "right") {
        // For erasure region: area between -τ and τ (or extended if τ is negative/positive)
        let inErasureRegion = false;
        let inNegativeErasureRegion = false;
        
        if (overlapMode === "left") {
          // When τ is positive: between -τ and τ
          if (threshold > 0) {
            inErasureRegion = x >= negThreshold && x <= threshold;
          } else {
            // When τ is negative: between -τ and τ
            inErasureRegion = x >= negThreshold && x <= threshold;
          }
          
          // For negative tau erasure (in opposite direction)
          if (showNegativeTauErasure) {
            if (threshold > 0) {
              inNegativeErasureRegion = x <= negThreshold;
            } else {
              inNegativeErasureRegion = x >= threshold;
            }
          }
        } else if (overlapMode === "right") {
          // When τ is positive: between τ and infinity
          if (threshold > 0) {
            inErasureRegion = x >= threshold;
          } else {
            // When τ is negative: between -τ and τ
            inErasureRegion = x >= threshold && x <= negThreshold;
          }
          
          // For negative tau erasure (in opposite direction)
          if (showNegativeTauErasure) {
            if (threshold > 0) {
              inNegativeErasureRegion = x >= negThreshold;
            } else {
              inNegativeErasureRegion = x <= threshold;
            }
          }
        }
        
        // Handle overlap - when both erasure regions apply, only show one
        // This ensures when they overlap, only one is displayed
        if (inErasureRegion && inNegativeErasureRegion) {
          // Keep only one active in case of overlap
          inNegativeErasureRegion = false;
        }
        
        // Calculate the displayed erasure value based on both regions
        erasureRegionValues.push(
          (inErasureRegion || inNegativeErasureRegion) ? Math.max(f1, f2) : 0
        );
      }
      
      // For erasure region calculations in all modes
      const lowerThreshold = Math.min(threshold, negThreshold);
      const upperThreshold = Math.max(threshold, negThreshold);
      f1ErasureValues.push(x >= lowerThreshold && x <= upperThreshold ? f1 : 0);
      f2ErasureValues.push(x >= lowerThreshold && x <= upperThreshold ? f2 : 0);
    }
  
    // Calculate total overlap area (numerical integration using trapezoid rule)
    let totalOverlap = 0;
    for (let i = 0; i < minValues.length - 1; i++) {
      totalOverlap += (minValues[i] + minValues[i + 1]) * step / 2;
    }
    
    // Calculate error regions (bit flips)
    let f1Error = 0; // Area under f1 in error region
    let f2Error = 0; // Area under f2 in error region
    
    // Calculate error regions based on the current mode
    for (let i = 0; i < xValues.length - 1; i++) {
      const dx = xValues[i+1] - xValues[i];
      
      // Calculate error probabilities
      f1Error += (f1ErrorValues[i] + f1ErrorValues[i+1]) * dx / 2;
      f2Error += (f2ErrorValues[i] + f2ErrorValues[i+1]) * dx / 2;
    }
    
    // Calculate erasure regions
    let erasureProbSum = 0;
    for (let i = 0; i < xValues.length - 1; i++) {
      const dx = xValues[i+1] - xValues[i];
      
      if (overlapMode === "left" || overlapMode === "right") {
        // Use precalculated values from the erasure region
        erasureProbSum += (erasureRegionValues[i] + erasureRegionValues[i+1]) * dx / 2;
      } else {
        // For other modes, calculate using traditional method
        const f1ErasureSum = (f1ErasureValues[i] + f1ErasureValues[i+1]) * dx / 2;
        const f2ErasureSum = (f2ErasureValues[i] + f2ErasureValues[i+1]) * dx / 2;
        erasureProbSum += f1ErasureSum + f2ErasureSum;
      }
    }
    
    // Set probabilities
    errorProbability = f1Error + f2Error;
    erasureProbability = erasureProbSum;
    
    // Set overlap area based on selected mode
    if (overlapMode === "total") {
      overlapArea = totalOverlap;
    } else if (overlapMode === "left") {
      let leftOverlap = 0;
      for (let i = 0; i < leftOfThresholdValues.length - 1; i++) {
        leftOverlap += (leftOfThresholdValues[i] + leftOfThresholdValues[i + 1]) * step / 2;
      }
      overlapArea = leftOverlap;
    } else if (overlapMode === "right") {
      let rightOverlap = 0;
      for (let i = 0; i < rightOfThresholdValues.length - 1; i++) {
        rightOverlap += (rightOfThresholdValues[i] + rightOfThresholdValues[i + 1]) * step / 2;
      }
      overlapArea = rightOverlap;
    } else {
      // In baseline mode, show the total overlap
      overlapArea = totalOverlap;
    }
  
    // Define traces for the two Gaussians and the region areas
    const trace1 = {
      x: xValues,
      y: f1Values,
      mode: 'lines',
      name: 'Signal -1',
      line: { color: '#4287f5', width: 2.5 }  // Blue for signal -1
    };
  
    const trace2 = {
      x: xValues,
      y: f2Values,
      mode: 'lines',
      name: 'Signal 1',
      line: { color: '#f54242', width: 2.5 }  // Red for signal 1
    };
  
    // Define traces for error and erasure areas based on overlap mode
    let dataTraces = [trace1, trace2];
  
    if (overlapMode === "baseline") {
      // In baseline mode, we color only the overlap areas with the color of the curve directly above
      dataTraces = [];
      
      // First add the basic curves without fill
      const trace1NofFill = {
        x: xValues,
        y: f1Values,
        mode: 'lines',
        name: 'Signal -1',
        line: { color: '#4287f5', width: 2.5 }  // Blue for signal -1
      };
  
      const trace2NoFill = {
        x: xValues,
        y: f2Values,
        mode: 'lines',
        name: 'Signal 1',
        line: { color: '#f54242', width: 2.5 }  // Red for signal 1
      };
      
      // Add the overlap areas with appropriate colors
      const blueOverlapArea = {
        x: xValues,
        y: f1DirectValues,
        fill: 'tozeroy',
        fillcolor: 'rgba(66, 135, 245, 0.4)',  // Blue for signal -1
        line: { color: 'rgba(0,0,0,0)', width: 0 },  // Invisible line
        name: 'Overlap (Signal 1 above)',
        showlegend: true
      };
      
      const redOverlapArea = {
        x: xValues,
        y: f2DirectValues,
        fill: 'tozeroy',
        fillcolor: 'rgba(245, 66, 66, 0.4)',  // Red for signal 1
        line: { color: 'rgba(0,0,0,0)', width: 0 },  // Invisible line
        name: 'Overlap (Signal -1 above)',
        showlegend: true
      };
      
      // Add traces in order: overlap areas first, then curves on top
      dataTraces.push(blueOverlapArea, redOverlapArea, trace1NofFill, trace2NoFill);
      
    } else if (overlapMode === "total") {
      // In total mode, show a solid gold overlap between curves
      const traceOverlap = {
        x: xValues,
        y: minValues,
        mode: 'lines',
        name: 'Overlap Area',
        fill: 'tozeroy',
        fillcolor: 'rgba(255, 215, 0, 0.3)',  // Light gold for overlap
        line: { color: '#ffd700', width: 2 }
      };
      dataTraces.push(traceOverlap);
      
    } else {
      // For left/right modes, use the improved overlap logic
      // Define arrays for color-coded overlap areas
      const overlapF1Above = [];
      const overlapF2Above = [];
      
      // Calculate overlaps based on which curve is above
      for (let i = 0; i < xValues.length; i++) {
        const x = xValues[i];
        const overlap = f1Values[i] > 0 && f2Values[i] > 0;
        let inThresholdRegion;
        
        if (overlapMode === "left") {
          inThresholdRegion = x <= threshold;
        } else { // overlapMode === "right"
          inThresholdRegion = x >= threshold;
        }
        
        // Determine which curve is above for coloring
        const f1Above = f1Values[i] > f2Values[i];
        const overlapValue = Math.min(f1Values[i], f2Values[i]);

        // Store overlap values - not conditional on threshold region anymore
        overlapF1Above.push(overlap && !f1Above ? overlapValue : 0);
        overlapF2Above.push(overlap && f1Above ? overlapValue : 0);
      }
      
      // Create traces for colored overlap areas
      const blueOverlapArea = {
        x: xValues,
        y: overlapF1Above,
        fill: 'tozeroy',
        fillcolor: 'rgba(66, 135, 245, 0.4)',
        line: { color: 'rgba(0,0,0,0)', width: 0 },
        name: `Overlap (Signal 1 above) ${overlapMode === "left" ? "Left" : "Right"} of τ`,
        showlegend: true
      };
      
      const redOverlapArea = {
        x: xValues,
        y: overlapF2Above,
        fill: 'tozeroy',
        fillcolor: 'rgba(245, 66, 66, 0.4)',
        line: { color: 'rgba(0,0,0,0)', width: 0 },
        name: `Overlap (Signal -1 above) ${overlapMode === "left" ? "Left" : "Right"} of τ`,
        showlegend: true
      };
      
      // Add the color-coded overlap areas
      dataTraces.push(blueOverlapArea, redOverlapArea);
      
      // Add the green erasure region
      const traceErasure = {
        x: xValues,
        y: erasureRegionValues,
        mode: 'lines',
        name: 'Erasure Region',
        fill: 'tozeroy',
        fillcolor: 'rgba(46, 204, 113, 0.3)',  // Light green for erasure
        line: { color: '#2ecc71', width: 1.5 }
      };
      dataTraces.push(traceErasure);
    }
  
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
  
    dataTraces.push(centerLine1, centerLine2);
  
    // Only show threshold lines when in left or right mode
    if (overlapMode === "left" || overlapMode === "right") {
      // Negative threshold line
      const negThresholdLine = {
        x: [negThreshold, negThreshold],
        y: [0, Math.max(Math.max(...f1Values), Math.max(...f2Values))],
        mode: 'lines',
        name: '-Threshold (-τ)',
        line: { color: '#ff6600', dash: 'dash', width: 2 }
      };
  
      // Threshold line
      const thresholdLine = {
        x: [threshold, threshold],
        y: [0, Math.max(Math.max(...f1Values), Math.max(...f2Values))],
        mode: 'lines',
        name: 'Threshold (τ)',
        line: { color: '#ffcc00', dash: 'dash', width: 2 }
      };
      
      dataTraces.push(negThresholdLine, thresholdLine);
    }
  
    const layout = {
      title: 'Gaussian Distributions and Error Analysis',
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
  
    Plotly.react(plotDiv, dataTraces, layout, config);
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
  
  function validateThreshold(event) {
    threshold = Math.min(5, Math.max(-5, parseFloat(event.target.value) || 0));
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
      case 'threshold':
        threshold = Math.min(5, Math.max(-5, threshold + direction * adjustmentAmount));
        threshold = roundToStepPrecision(threshold, currentStepSize);
        validateThreshold({ target: { value: threshold } });
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
  
  // Handler for overlap mode change
  function handleOverlapModeChange() {
    updatePlot();
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
      
      <label class="overlap-mode">
        Overlap Mode:
        <select bind:value={overlapMode} on:change={handleOverlapModeChange}>
          <option value="baseline">Baseline (Curve-wise Fill)</option>
          <option value="total">Total Overlap Area</option>
          <option value="left">Left of τ</option>
          <option value="right">Right of τ</option>
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
      
      {#if overlapMode !== "baseline" && overlapMode !== "total"}
      <div class="threshold-row">
        <div class="threshold-container">
          <div class="threshold-label-container">
            <label>
              Threshold (τ):
              <input type="number" min="-5" max="5" step={stepSize} bind:value={threshold} on:input={validateThreshold} />
            </label>
          </div>
          <div class="threshold-slider-wrapper" on:wheel={e => handleSliderWheel(e, 'threshold')}>
            <input type="range" min="-5" max="5" step={stepSize} bind:value={threshold} on:input={updatePlot} />
          </div>
          {#if overlapMode === "left" || overlapMode === "right"}
              <div class="toggle-container">
                <label class="toggle-switch">
                  <input type="checkbox" bind:checked={showNegativeTauErasure} on:change={updatePlot}>
                  <span class="toggle-slider"></span>
                </label>
                <span>Show Negative τ Erasure Area</span>
              </div>
            {/if}
        </div>
      </div>
      {/if}
    </div>
  
    <div bind:this={plotDiv} class="plot-container"></div>
  
    <div class="stats-container">
      <h2>Current Visible Overlap Area: <span class="gradient-text">{overlapArea.toFixed(4)}</span></h2>
      
      <!-- Show error and erasure probabilities for modes with thresholds -->
      {#if overlapMode === "left" || overlapMode === "right"}
        <h2>Bit Flip Probability (Pe): <span class="gradient-text error">{errorProbability.toFixed(4)}</span></h2>
        <h2>Erasure Probability (Pc): <span class="gradient-text erasure">{erasureProbability.toFixed(4)}</span></h2>
      {/if}
    </div>
    
    <div class="instructions">
      <p><strong>Trackpad Navigation:</strong></p>
      <ul>
        <li>Zoom: Ctrl/Cmd + Scroll OR Zoom Motion (centered on mouse)</li>
        <li>Pan: Scroll left/right</li>
        <li>Adjust sliders: Hover over a slider and scroll/swipe</li>
      </ul>
      
      <div class="formula-explanation">
        {#if overlapMode === "baseline"}
          <p><strong>Baseline Mode:</strong> Only overlap areas are colored, using the color of the curve directly above</p>
          <p class="color-key"><span class="color-chip blue"></span> Blue fill: Overlap area where Signal 1 is above</p>
          <p class="color-key"><span class="color-chip red"></span> Red fill: Overlap area where Signal -1 is above</p>
        {:else if overlapMode === "total"}
          <p><strong>Total Overlap Mode:</strong> The entire overlap area is highlighted in gold</p>
          <p class="color-key"><span class="color-chip gold"></span> Gold fill: Total area where both curves overlap</p>
        {:else if overlapMode === "left"}
          <p><strong>Bit Flip Probability (Pe):</strong> P<sub>e</sub> = ∫<sub>τ</sub><sup>∞</sup> f<sub>1</sub>(x) dx + ∫<sub>-∞</sub><sup>-τ</sup> f<sub>2</sub>(x) dx</p>
          <p><strong>Erasure Probability (Pc):</strong> P<sub>c</sub> = ∫<sub>-τ</sub><sup>τ</sup> f<sub>1</sub>(x) dx + ∫<sub>-τ</sub><sup>τ</sup> f<sub>2</sub>(x) dx</p>
          <p class="color-key"><span class="color-chip blue"></span> Blue fill: Overlap area where Signal 1 is above left of τ</p>
          <p class="color-key"><span class="color-chip red"></span> Red fill: Overlap area where Signal -1 is above left of τ</p>
          <p class="color-key"><span class="color-chip green"></span> Green fill: Erasure region left of τ & right of -τ</p>
        {:else}
          <p><strong>Bit Flip Probability (Pe):</strong> P<sub>e</sub> = ∫<sub>τ</sub><sup>∞</sup> f<sub>1</sub>(x) dx + ∫<sub>-∞</sub><sup>-τ</sup> f<sub>2</sub>(x) dx</p>
          <p><strong>Erasure Probability (Pc):</strong> P<sub>c</sub> = ∫<sub>-τ</sub><sup>τ</sup> f<sub>1</sub>(x) dx + ∫<sub>-τ</sub><sup>τ</sup> f<sub>2</sub>(x) dx</p>
          <p class="color-key"><span class="color-chip blue"></span> Blue fill: Overlap area where Signal 1 is above right of τ</p>
          <p class="color-key"><span class="color-chip red"></span> Red fill: Overlap area where Signal -1 is above right of τ</p>
          <p class="color-key"><span class="color-chip green"></span> Green fill: Erasure region right of τ & left of -τ</p>
        {/if}
      </div>
    </div>
  </div>