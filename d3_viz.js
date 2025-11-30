// d3_viz.js - D3 KDE Visualization for Sanitation vs Life Expectancy

async function loadAndVisualize() {
    try {
        // Load CSV file using fetch (works in standard browsers)
        const response = await fetch('Global Health.csv');
        const fileData = await response.text();
        
        // Parse CSV
        const parsed = Papa.parse(fileData, {
            header: true,
            dynamicTyping: true,
            skipEmptyLines: true
        });

        let data = parsed.data;
        
        // Debug: Log the first row to see column names
        if (data.length > 0) {
            console.log('Available columns:', Object.keys(data[0]));
            console.log('First row:', data[0]);
        }
        
        // Try to find the correct column names (handle variations in spacing/capitalization)
        const sanitationCol = Object.keys(data[0]).find(key => 
            key.toLowerCase().includes('sanitation') && key.toLowerCase().includes('total')
        );
        const lifeExpectancyCol = Object.keys(data[0]).find(key => 
            key.toLowerCase().includes('life') && key.toLowerCase().includes('expectancy')
        );
        
        console.log('Sanitation column found:', sanitationCol);
        console.log('Life expectancy column found:', lifeExpectancyCol);
        
        if (!sanitationCol || !lifeExpectancyCol) {
            document.getElementById('chart').innerHTML = 
                `<div class="loading">Could not find required columns.<br><br>
                Available columns: ${Object.keys(data[0]).join(', ')}<br><br>
                Looking for columns containing "sanitation" and "life expectancy"</div>`;
            return;
        }
        
        // Filter out rows with missing values
        data = data.filter(d => 
            d[sanitationCol] != null && 
            d[lifeExpectancyCol] != null &&
            !isNaN(d[sanitationCol]) &&
            !isNaN(d[lifeExpectancyCol])
        );

        if (data.length === 0) {
            document.getElementById('chart').innerHTML = '<div class="loading">No valid data found after filtering</div>';
            return;
        }

        console.log(`Loaded ${data.length} valid data points`);

        // Create the visualization
        createKDEPlot(data, sanitationCol, lifeExpectancyCol);
        
    } catch (error) {
        console.error('Error:', error);
        document.getElementById('chart').innerHTML = 
            `<div class="loading">Error loading data: ${error.message}<br><br>Make sure 'Global Health.csv' is in the same directory as this HTML file.</div>`;
    }
}

function createKDEPlot(data, sanitationCol, lifeExpectancyCol) {
    // Clear loading message
    document.getElementById('chart').innerHTML = '';

    const margin = { top: 20, right: 40, bottom: 60, left: 70 };
    const width = 900 - margin.left - margin.right;
    const height = 600 - margin.top - margin.bottom;

    const svg = d3.select("#chart")
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Get data ranges
    const xExtent = d3.extent(data, d => d[sanitationCol]);
    const yExtent = d3.extent(data, d => d[lifeExpectancyCol]);

    // Scales
    const x = d3.scaleLinear()
        .domain([Math.max(0, xExtent[0] - 5), Math.min(100, xExtent[1] + 5)])
        .range([0, width]);

    const y = d3.scaleLinear()
        .domain([yExtent[0] - 5, yExtent[1] + 5])
        .range([height, 0]);

    // Calculate 2D density
    const gridSize = 40;
    const gridData = [];
    const bandwidth = (xExtent[1] - xExtent[0]) / 10; // Adaptive bandwidth

    for (let i = 0; i < gridSize; i++) {
        for (let j = 0; j < gridSize; j++) {
            const xVal = x.domain()[0] + (x.domain()[1] - x.domain()[0]) * i / gridSize;
            const yVal = y.domain()[0] + (y.domain()[1] - y.domain()[0]) * j / gridSize;
            
            let density = 0;
            data.forEach(d => {
                const dx = (xVal - d[sanitationCol]) / bandwidth;
                const dy = (yVal - d[lifeExpectancyCol]) / (bandwidth * 0.5);
                const distance = Math.sqrt(dx * dx + dy * dy);
                density += Math.exp(-0.5 * distance * distance);
            });
            
            gridData.push({
                x: xVal,
                y: yVal,
                density: density
            });
        }
    }

    // Color scale
    const colorScale = d3.scaleSequential(d3.interpolateViridis)
        .domain([0, d3.max(gridData, d => d.density)]);

    // Draw density heatmap
    svg.selectAll("rect")
        .data(gridData)
        .enter()
        .append("rect")
        .attr("x", d => x(d.x))
        .attr("y", d => y(d.y))
        .attr("width", width / gridSize + 1)
        .attr("height", height / gridSize + 1)
        .attr("fill", d => colorScale(d.density))
        .attr("opacity", 0.7);

    // Tooltip
    const tooltip = d3.select("#tooltip");

    // Draw scatter points
    svg.selectAll("circle")
        .data(data)
        .enter()
        .append("circle")
        .attr("cx", d => x(d[sanitationCol]))
        .attr("cy", d => y(d[lifeExpectancyCol]))
        .attr("r", 3)
        .attr("fill", "#ff6b6b")
        .attr("stroke", "white")
        .attr("stroke-width", 1)
        .attr("opacity", 0.6)
        .on("mouseover", function(event, d) {
            d3.select(this)
                .attr("r", 6)
                .attr("opacity", 1);
            
            tooltip
                .style("opacity", 1)
                .html(`Sanitation: ${d[sanitationCol].toFixed(1)}%<br>Life Expectancy: ${d[lifeExpectancyCol].toFixed(1)} years`)
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 10) + "px");
        })
        .on("mouseout", function() {
            d3.select(this)
                .attr("r", 3)
                .attr("opacity", 0.6);
            
            tooltip.style("opacity", 0);
        });

    // X axis
    svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x))
        .selectAll("text")
        .style("font-size", "12px");

    // Y axis
    svg.append("g")
        .call(d3.axisLeft(y))
        .selectAll("text")
        .style("font-size", "12px");

    // X axis label
    svg.append("text")
        .attr("class", "axis-label")
        .attr("x", width / 2)
        .attr("y", height + 45)
        .attr("text-anchor", "middle")
        .text("Safely Managed Sanitation (% of population)");

    // Y axis label
    svg.append("text")
        .attr("class", "axis-label")
        .attr("transform", "rotate(-90)")
        .attr("x", -height / 2)
        .attr("y", -50)
        .attr("text-anchor", "middle")
        .text("Life Expectancy (years)");

    // Add legend
    const legendWidth = 200;
    const legendHeight = 10;
    const legendScale = d3.scaleLinear()
        .domain(colorScale.domain())
        .range([0, legendWidth]);

    const legend = svg.append("g")
        .attr("transform", `translate(${width - legendWidth - 20}, ${height - 30})`);

    const legendAxis = d3.axisBottom(legendScale)
        .ticks(5)
        .tickFormat(d3.format(".0f"));

    // Legend gradient
    const defs = svg.append("defs");
    const gradient = defs.append("linearGradient")
        .attr("id", "legend-gradient");

    gradient.selectAll("stop")
        .data(d3.range(0, 1.1, 0.1))
        .enter()
        .append("stop")
        .attr("offset", d => `${d * 100}%`)
        .attr("stop-color", d => colorScale(d * d3.max(gridData, g => g.density)));

    legend.append("rect")
        .attr("width", legendWidth)
        .attr("height", legendHeight)
        .style("fill", "url(#legend-gradient)");

    legend.append("g")
        .attr("transform", `translate(0, ${legendHeight})`)
        .call(legendAxis)
        .selectAll("text")
        .style("font-size", "10px");

    legend.append("text")
        .attr("x", legendWidth / 2)
        .attr("y", -5)
        .attr("text-anchor", "middle")
        .style("font-size", "11px")
        .text("Density");
}

// Load data when page loads
window.addEventListener('DOMContentLoaded', loadAndVisualize);