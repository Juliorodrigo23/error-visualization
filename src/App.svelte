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
  let blueOverlapComponent = 0; // For tracking signal -1 component (blue fill)
  let redOverlapComponent = 0;  // For tracking signal 1 component (red fill)
  let correctProbability = 0; // Pc - correct probability
  
  let xStart = -5; // Initial x-axis range
  let xEnd = 5;
  
  function isErased(x) {
  let inErasure = false;
  let inNegErasure = false;

  if (overlapMode === "left") {
    if (threshold > 0) {
      // When τ is positive in left mode: erase between -τ and τ
      inErasure = x >= -threshold && x <= threshold;
    } else {
      // When τ is negative in left mode: erase x <= τ
      inErasure = x <= threshold;
    }
    
    if (showNegativeTauErasure) {
      if (threshold > 0) {
        // When τ is positive: negative tau erasure is same as positive (-τ to τ)
        inNegErasure = x >= -threshold && x <= threshold;
      } else {
        // When τ is negative: negative tau erasure is x >= -τ
        inNegErasure = x >= -threshold;
      }
    }
  }
  else if (overlapMode === "right") {
    if (threshold >= 0) {
      // When τ is positive in right mode: erase x >= τ
      inErasure = x >= threshold;
    } else {
      // When τ is negative in right mode: erase between τ and -τ
      inErasure = x >= threshold && x <= -threshold;
    }
    
    if (showNegativeTauErasure) {
      if (threshold >= 0) {
        // When τ is positive: negative tau erasure is x <= -τ
        inNegErasure = x <= -threshold;
      } else {
        // When τ is negative: negative tau erasure is already covered by main erasure
        inNegErasure = false;
      }
    }
  }

  // Handle overlap - only count once
  if (inErasure && inNegErasure) {
    inNegErasure = false;
  }

  return inErasure || inNegErasure;
}


  // Gaussian PDF function
  function gaussian(x, center, sigma, amplitude) {
    return amplitude * (1 / (Math.sqrt(2 * Math.PI) * sigma)) * Math.exp(-((x - center) ** 2) / (2 * sigma * sigma));
  }
  
  function computeBitFlipRegions(xValues, f1Values, f2Values, threshold) {
    const f1ErrorValues = [];
    const f2ErrorValues = [];

    for (let i = 0; i < xValues.length; i++) {
      const x = xValues[i];
      const f1 = f1Values[i];
      const f2 = f2Values[i];

      // Skip if in erasure region
      if (isErased(x)) {
        f1ErrorValues.push(0);
        f2ErrorValues.push(0);
        continue;
      }

      // Signal -1 misread as 1 (x > 0)
      f1ErrorValues.push(x > 0 ? f1 : 0);
      // Signal 1 misread as -1 (x < 0)
      f2ErrorValues.push(x < 0 ? f2 : 0);
    }

    return { f1ErrorValues, f2ErrorValues };
  }

function computeErasureRegions(xValues, f1Values, f2Values, threshold) {
  const f1ErasureValues = [];
  const f2ErasureValues = [];

  const lowerTau = Math.min(threshold, -threshold);
  const upperTau = Math.max(threshold, -threshold);

  for (let i = 0; i < xValues.length; i++) {
    const x = xValues[i];
    const f1 = f1Values[i];
    const f2 = f2Values[i];

    const inErasure = x >= lowerTau && x <= upperTau;
    f1ErasureValues.push(inErasure ? f1 : 0);
    f2ErasureValues.push(inErasure ? f2 : 0);
  }

  return { f1ErasureValues, f2ErasureValues };
}


  // Function to update the plot and compute the overlap area
  function updatePlot() {
    if (!plotDiv) return;
    const containerWidth = plotDiv.clientWidth;
    const containerHeight = plotDiv.clientHeight;

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
      f1DirectValues.push(overlap && f2 > f1 ? minVal : overlap && f2 === f1 ? minVal / 2 : 0);
      f2DirectValues.push(overlap && f1 > f2 ? minVal : overlap && f2 === f1 ? minVal / 2 : 0);

      
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
            inErasureRegion = x <= threshold;
          }
          
          // For negative tau erasure (in opposite direction)
          if (showNegativeTauErasure) {
            if (threshold > 0) {
              inNegativeErasureRegion = x >= negThreshold && x <= threshold;
            } else {
              inNegativeErasureRegion = x >= negThreshold;
            }
          }
        } else if (overlapMode === "right") {
          // When τ is positive: between τ and infinity
          if (threshold >= 0) {
            inErasureRegion = x >= threshold ;
          } else {
            // When τ is negative: between -τ and τ
            inErasureRegion = x >= threshold && x <= negThreshold;
          }
          
          // For negative tau erasure (in opposite direction)
          if (showNegativeTauErasure) {
            if (threshold >= 0) {
              inNegativeErasureRegion = x <= negThreshold;
            } else {
              inNegativeErasureRegion = x <= negThreshold && x >= threshold;
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
    }
  
        if (overlapMode === "left" || overlapMode === "right") {
          const result = computeBitFlipRegions(xValues, f1Values, f2Values, threshold);
          f1ErrorValues.push(...result.f1ErrorValues);
          f2ErrorValues.push(...result.f2ErrorValues);
        }

        const erasureResult = computeErasureRegions(xValues, f1Values, f2Values, threshold);
        f1ErasureValues.push(...erasureResult.f1ErasureValues);
        f2ErasureValues.push(...erasureResult.f2ErasureValues);


    // Calculate total overlap area (numerical integration using trapezoid rule)
    let totalOverlap = 0;
    for (let i = 0; i < minValues.length - 1; i++) {
      totalOverlap += (minValues[i] + minValues[i + 1]) * step / 2;
    }
    
    let area1 = 0, area2 = 0;
    for (let i = 0; i < xValues.length - 1; i++) {
      const dx = xValues[i + 1] - xValues[i];
      area1 += (f1Values[i] + f1Values[i + 1]) * dx / 2;
      area2 += (f2Values[i] + f2Values[i + 1]) * dx / 2;
    }
    const totalArea = area1 + area2;

    let redComponent = 0;
    let blueComponent = 0;

    for (let i = 0; i < xValues.length - 1; i++) {
      const dx = xValues[i + 1] - xValues[i];

      const f1 = f1Values[i];
      const f2 = f2Values[i];
      const f1Next = f1Values[i + 1];
      const f2Next = f2Values[i + 1];

      const minCurr = Math.min(f1, f2);
      const minNext = Math.min(f1Next, f2Next);
      const avgOverlap = (minCurr + minNext) * dx / 2;

      const f1AboveCount = Number(f1 > f2) + Number(f1Next > f2Next);
      const f2AboveCount = Number(f2 > f1) + Number(f2Next > f1Next);

      if (f1AboveCount > f2AboveCount) {
        redComponent += avgOverlap;
      } else if (f2AboveCount > f1AboveCount) {
        blueComponent += avgOverlap;
      } else {
        redComponent += avgOverlap / 2;
        blueComponent += avgOverlap / 2;
      }
    }


    blueOverlapComponent = blueComponent;
    redOverlapComponent = redComponent;

    
    // Set probabilities
        // Use these variables for error and erasure after computing overlapArea
    let f1Error = 0;
    let f2Error = 0;

    const lowerTau = Math.min(threshold, -threshold);
    const upperTau = Math.max(threshold, -threshold);
    f1Error = 0;
    f2Error = 0;

    for (let i = 0; i < xValues.length - 1; i++) {
      const xMid = (xValues[i] + xValues[i + 1]) / 2;
      const dx = xValues[i + 1] - xValues[i];

      // Skip anything in the erasure region
      const inErasure = isErased(xMid);
      if (inErasure) continue;

      // Outside erasure: count bit flips based on the midpoint between distributions
      // For signal -1 (f1): bit flip when x > 0 and not in erasure
      if (xMid > 0) {
        f1Error += (f1Values[i] + f1Values[i + 1]) * dx / 2;
      }
      // For signal 1 (f2): bit flip when x < 0 and not in erasure
      if (xMid < 0) {
        f2Error += (f2Values[i] + f2Values[i + 1]) * dx / 2;
      }
    }
    
    const totalF1Mass = area1;
    const totalF2Mass = area2;
    const totalMass = totalF1Mass + totalF2Mass;
    errorProbability = (f1Error + f2Error) ;

    let f1ErasureArea = 0;
    let f2ErasureArea = 0;

    

    for (let i = 0; i < xValues.length - 1; i++) {
      const xMid = (xValues[i] + xValues[i + 1]) / 2;
      const dx = xValues[i + 1] - xValues[i];

      let inErasureRegion = false;
      let inNegativeErasureRegion = false;

      if (overlapMode === "left") {
        if (threshold > 0) {
          inErasureRegion = xMid >= -threshold && xMid <= threshold;
        } else {
          inErasureRegion = xMid <= threshold;
        }

        if (showNegativeTauErasure) {
          if (threshold > 0) {
            inNegativeErasureRegion = xMid >= -threshold && xMid <= threshold;
          } else {
            inNegativeErasureRegion = xMid >= -threshold;
          }
        }
      } else if (overlapMode === "right") {
        if (threshold >= 0) {
          inErasureRegion = xMid >= threshold;
        } else {
          inErasureRegion = xMid >= threshold && xMid <= -threshold;
        }

        if (showNegativeTauErasure) {
          if (threshold >= 0) {
            inNegativeErasureRegion = xMid <= -threshold;
          } else {
            inNegativeErasureRegion = xMid <= -threshold && xMid >= threshold;
          }
        }
      }

      // Avoid double-counting if both regions overlap
      if (inErasureRegion && inNegativeErasureRegion) {
        inNegativeErasureRegion = false;
      }

      if (inErasureRegion || inNegativeErasureRegion) {
        f1ErasureArea += (f1Values[i] + f1Values[i + 1]) * dx / 2;
        f2ErasureArea += (f2Values[i] + f2Values[i + 1]) * dx / 2;
      }
    }

    for (let i = 0; i < xValues.length - 1; i++) {
    const xMid = (xValues[i] + xValues[i + 1]) / 2;
    const dx = xValues[i + 1] - xValues[i];

    let inErasureRegion = false;
    let inNegativeErasureRegion = false;

    if (overlapMode === "left") {
      if (threshold > 0) {
        inErasureRegion = xMid >= -threshold && xMid <= threshold;
      } else {
        inErasureRegion = xMid <= threshold;
      }

      if (showNegativeTauErasure) {
        if (threshold > 0) {
          inNegativeErasureRegion = xMid >= -threshold && xMid <= threshold;
        } else {
          inNegativeErasureRegion = xMid >= -threshold;
        }
      }
    } else if (overlapMode === "right") {
      if (threshold >= 0) {
        inErasureRegion = xMid >= threshold;
      } else {
        inErasureRegion = xMid >= threshold && xMid <= -threshold;
      }

      if (showNegativeTauErasure) {
        if (threshold >= 0) {
          inNegativeErasureRegion = xMid <= -threshold;
        } else {
          inNegativeErasureRegion = xMid <= -threshold && xMid >= threshold;
        }
      }
    }

    if (inErasureRegion && inNegativeErasureRegion) {
      inNegativeErasureRegion = false;
    }

    const isErased = inErasureRegion || inNegativeErasureRegion;

    // Only count as error if NOT in erasure region
    
  }

    // Calculate total mass for normalization


const Pe = f1Error + f2Error;
const Pc = f1ErasureArea + f2ErasureArea;



    erasureProbability = (f1ErasureArea + f2ErasureArea)  / totalMass;

    correctProbability = 1 - errorProbability - erasureProbability;

    
    // Set overlap area based on selected mode
    if (overlapMode === "total") {
      overlapArea = totalOverlap;
    } else if (overlapMode === "left") {
      let leftOverlap = 0;
      for (let i = 0; i < leftOfThresholdValues.length - 1; i++) {
        leftOverlap += (leftOfThresholdValues[i] + leftOfThresholdValues[i + 1]) * step / 2;
      }
      overlapArea = totalOverlap;
    } else if (overlapMode === "right") {
      let rightOverlap = 0;
      for (let i = 0; i < rightOfThresholdValues.length - 1; i++) {
        rightOverlap += (rightOfThresholdValues[i] + rightOfThresholdValues[i + 1]) * step / 2;
      }
      overlapArea = totalOverlap;
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
        name: 'Bit flip (Signal -1 read as 1)',
        showlegend: true,
        mode: 'none'
      };
      
      const redOverlapArea = {
        x: xValues,
        y: f2DirectValues,
        fill: 'tozeroy',
        fillcolor: 'rgba(245, 66, 66, 0.4)',  // Red for signal 1
        line: { color: 'rgba(0,0,0,0)', width: 0 },  // Invisible line
        name: 'Bit flip (Signal 1 read as -1)',
        showlegend: true,
        mode: 'none'
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
        name: `Bit flip (Signal -1 read as 1)`,
        showlegend: true,
        mode: 'none'
      };
      
      const redOverlapArea = {
        x: xValues,
        y: overlapF2Above,
        fill: 'tozeroy',
        fillcolor: 'rgba(245, 66, 66, 0.4)',
        line: { color: 'rgba(0,0,0,0)', width: 0 },
        name: `Bit flip (Signal 1 read as -1)`,
        showlegend: true,
        mode: 'none'
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
        fixedrange: false,
        gridcolor: 'rgba(255, 255, 255, 0.1)',
        zerolinecolor: 'rgba(255, 255, 255, 0.2)'
      },
      yaxis: { 
        title: 'Probability Density',
        gridcolor: 'rgba(255, 255, 255, 0.1)',
        autorange: true,
        fixedrange: false,
        zerolinecolor: 'rgba(255, 255, 255, 0.2)'
      },
      showlegend: true,
      autosize: false,
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
      modeBarButtonsToRemove: ['select2d', 'lasso2d'], // Simplify the toolbar
      displayRatio: 1.6
    };
  
    Plotly.react(plotDiv, dataTraces, layout, config);
    setTimeout(() => {
      Plotly.Plots.resize(plotDiv);
    }, 50);

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
      <h2>
        Current Visible Overlap Area (No Erasures): 
        <span class="gradient-text">{overlapArea.toFixed(2)}</span>
        {#if overlapMode !== "total"}
        <div class="component-values">
          <span class="blue-component">Blue: {blueOverlapComponent.toFixed(2)}</span>
          <span class="red-component">Red: {redOverlapComponent.toFixed(2)}</span>
        </div>
        {/if}
      </h2>
      <!-- Show error and erasure probabilities for modes with thresholds -->
      {#if overlapMode === "left" || overlapMode === "right"}
        <h2>
          Bit Flip Probability (Pe): 
          <span class="gradient-text error">{errorProbability.toFixed(2)}</span>
        </h2>
        <h2>Erasure Probability (Pc): <span class="gradient-text erasure">{erasureProbability.toFixed(2)}</span></h2>
        <h2>Classification Probabilities:</h2>
        <div class="probability-bar">
          <div class="bar-fill">
            <div class="bar-section correct" style="width: {100 * correctProbability}%" title="Correct"></div>
            <div class="bar-section erasure" style="width: {100 * erasureProbability}%" title="Erasure"></div>
            <div class="bar-section error" style="width: {100 * errorProbability}%" title="Bit Flip"></div>
          </div>
          <div class="bar-labels">
            <div class="label-section correct">✅ Correct {Math.round(100 * correctProbability)}%</div>
            <div class="label-section erasure">⚠️ Erased {Math.round(100 * erasureProbability)}%</div>
            <div class="label-section error">❌ Bitflip {Math.round(100 * errorProbability)}%</div>
          </div>
        </div>
        
      {/if}
    </div>
    
    <div class="instructions">
      <p><strong>Trackpad Navigation:</strong></p>
      <ul>
        <li>Zoom: Ctrl/Cmd + Scroll OR Zoom Motion (centered on mouse)</li>
        <li>Pan: Scroll left/right</li>
        <li>Adjust sliders: Hover over a slider and scroll/swipe</li>
        <li>Click legend: Toggle components visually without adjusting logic </li>
      </ul>
      
      <div class="formula-explanation">
        {#if overlapMode === "baseline"}
          <p><strong>Baseline Mode:</strong> Only overlap areas are colored, using the color of the curve directly above. This signifies an incorrect reading (bit flip) when receiving a signal with noise.</p>
          <p class="color-key"><span class="color-chip blue"></span> Blue fill: Overlap area where Signal -1 is misinterpreted as 1 in a bit flip</p>
          <p class="color-key"><span class="color-chip red"></span> Red fill: Overlap area where Signal 1 is misinterpreted as -1 in a bit flip</p>
        {:else if overlapMode === "total"}
          <p><strong>Total Overlap Mode:</strong> The entire overlap area is highlighted in gold</p>
          <p class="color-key"><span class="color-chip gold"></span> Gold fill: Total area where both curves overlap. Total bit flip area</p>
        {:else if overlapMode === "left"}
          <p><strong>Bit Flip Probability (Pe):</strong> P<sub>e</sub> = ∫<sub>τ</sub><sup>∞</sup> f<sub>1</sub>(x) dx + ∫<sub>-∞</sub><sup>-τ</sup> f<sub>2</sub>(x) dx</p>
          <p><strong>Erasure Probability (Pc):</strong> P<sub>c</sub> = ∫<sub>-τ</sub><sup>τ</sup> f<sub>1</sub>(x) dx + ∫<sub>-τ</sub><sup>τ</sup> f<sub>2</sub>(x) dx</p>
          <p class="color-key"><span class="color-chip blue"></span> Blue fill: Overlap area where Signal -1 is not affected by erasure and bit flip occurs</p>
          <p class="color-key"><span class="color-chip red"></span> Red fill: Overlap area where Signal 1 is not affected by erasure and bit flip occurs</p>
          <p class="color-key"><span class="color-chip green"></span> Green fill: Erasure region left of τ & right of -τ</p>
        {:else}
          <p><strong>Bit Flip Probability (Pe):</strong> P<sub>e</sub> = ∫<sub>τ</sub><sup>∞</sup> f<sub>1</sub>(x) dx + ∫<sub>-∞</sub><sup>-τ</sup> f<sub>2</sub>(x) dx</p>
          <p><strong>Erasure Probability (Pc):</strong> P<sub>c</sub> = ∫<sub>-τ</sub><sup>τ</sup> f<sub>1</sub>(x) dx + ∫<sub>-τ</sub><sup>τ</sup> f<sub>2</sub>(x) dx</p>
          <p class="color-key"><span class="color-chip blue"></span> Blue fill: Overlap area where Signal -1 is not affected by erasure and bit flip occurs</p>
          <p class="color-key"><span class="color-chip red"></span> Red fill: Overlap area where Signal 1 is not affected by erasure and bit flip occurs</p>
          <p class="color-key"><span class="color-chip green"></span> Green fill: Erasure region right of τ & left of -τ</p>
        {/if}
      </div>
    </div>
  </div>