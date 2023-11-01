d3.csv("http://vis.lab.djosix.com:2023/data/ma_lga_12345.csv").then(function(data) {

    // Define 
    var svgWidth = 1200, svgHeight = 500;
    const margin = {top: 50, right: 230, bottom: 200, left: 50};
    var width = svgWidth - margin.left - margin.right;
    var height = svgHeight - margin.top - margin.bottom;

    const widthSlider = document.getElementById("width-slider");
    const widthValue = document.getElementById("width-value");
    const heightSlider = document.getElementById("height-slider");
    const heightValue = document.getElementById("height-value");
    widthSlider.value = svgWidth;
    heightSlider.value = svgHeight;
    widthValue.textContent = svgWidth;
    heightValue.textContent = svgHeight;

    var sortOrder = "ascending";

    // Initialize the svg
    const svg = d3.select("body").append("svg")
        .attr("width", svgWidth)
        .attr("height", svgHeight)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Initialize data
    // sale date: dd/mm/yy => yy/mm/dd
    data.forEach(function(d) {
        var parts = d.saledate.split('/');
        d.saledate = parts[2] + '/' + parts[1] + '/' + parts[0];
    });

    // Listen to the change event on the sort-order selector dropdown
    d3.select("#sort-order-selector").on("change", function() {
        // Get the selected sort order value
        sortOrder = this.value;
        if (sortOrder === "descending") {
            updateChart(selectedTypes, "descending");
        } else if (sortOrder === "ascending") {
            updateChart(selectedTypes, "ascending");
        }
    });

    // Select all checkboxes on the page
    const checkboxes = document.querySelectorAll('input[type="checkbox"]');

    let selectedTypes = [];
    // Listen to the change event on checkboxes
    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', function() {
        // If the checkbox is checked, add the type to selectedTypes
        if (this.checked) {
            selectedTypes.push(this.value);
        } else {
            // If the checkbox is unchecked, remove the type from selectedTypes
            const index = selectedTypes.indexOf(this.value);
            if (index !== -1) {
            selectedTypes.splice(index, 1);
            }
        }
        // Update the chart with the selected types and current sort order
        updateChart(selectedTypes, sortOrder);
        });
    });
    
    // Initialize the selectedTypes array
    selectedTypes = Array.from(checkboxes)
        .filter(checkbox => checkbox.checked)
        .map(checkbox => checkbox.value);

    // Update svg size
    widthSlider.addEventListener("input", updateSVGSize);
    heightSlider.addEventListener("input", updateSVGSize);

    // Initialize
    updateChart(selectedTypes, sortOrder)

    // Update the SVG size
    function updateSVGSize() {
        // Get the values of width and height from the sliders
        svgWidth = +widthSlider.value;
        svgHeight = +heightSlider.value;

        // Update the width and height attributes of the SVG
        svg.attr("width", svgWidth)
            .attr("height", svgHeight);

        // Update the width and height variables
        width = svgWidth - margin.left - margin.right;
        height = svgHeight - margin.top - margin.bottom;

        // Update the displayed values on the page
        widthValue.textContent = svgWidth;
        heightValue.textContent = svgHeight;
        updateChart(selectedTypes, sortOrder)
    }
    



    // update the Theme River image
    function updateChart(selectedTypes, sortOrder) {

        // Sorting
        if (sortOrder === "ascending") {
            data.sort(function(a, b) {
                return new Date(a.saledate) - new Date(b.saledate);
            }); 
        } else {
            data.sort(function(a, b) {
                return new Date(b.saledate) - new Date(a.saledate);
            }); 
        }

        // Process the data to aggregate values by sale date and type
        var result = data.reduce(function(acc, cur) {
            var date = cur.saledate;
            var type = cur.type + cur.bedrooms;
            var value = cur.MA;
            
            var obj = acc.find(function(o) { return o.saledate === date; });
            if (obj) {
                obj[type] = value;
            } else {
                obj = { saledate: date };
                obj[type] = value;
                acc.push(obj);
            } return acc;
        }, []);
            
        // Fill missing values with 0
        result.forEach(function(obj) {
            ['house2', 'house3', 'house4', 'house5', 'unit1', 'unit2', 'unit3'].forEach(function(type) {
                if (!obj.hasOwnProperty(type)) {
                obj[type] = 0;
                }
            });
        });

        // Clear SVG
        svg.selectAll("*").remove();

        // Filter the data based on selected types
        const filteredData = result.filter(function(d) {
            return selectedTypes.some(type => d.hasOwnProperty(type));
        });

        // color map
        var color = d3.scaleOrdinal()
            .domain(['house2', 'house3', 'house4', 'house5', 'unit1', 'unit2', 'unit3'])
            .range(['#ff0000', '#ff8000', '#ffb000', '#ffe000', '#0000ff', '#0080ff', '#00b0ff']);


        // Initialize x-axis and scale
        if (sortOrder === "ascending") {
            var x = d3.scaleTime()
                .domain(d3.extent(filteredData, function(d) { return new Date(d.saledate); }))
                .range([0, width]);
        } else {
            var x = d3.scaleTime()
                .domain(d3.extent(filteredData, function(d) { return new Date(d.saledate); }))
                .range([width, 0]);
        }

        // Initialize y-axis and scale
        var y = d3.scaleLinear()
            .domain([
                0,
                d3.max(filteredData, function(d) { return d3.sum(Object.values(d)); })
            ])
            .range([height, 0]);

        // Define the stack generator
        var stack = d3.stack()
            .keys(selectedTypes)
            .offset(d3.stackOffsetSilhouette);

        // Generate stacked data
        var series = stack(filteredData);

        // Define the area generator
        var area = d3.area()
            .x(function(d) { return x(new Date(d.data.saledate)); })
            .y0(function(d) { return y(d[0]); })
            .y1(function(d) { return y(d[1]); });

        // Create and append path elements for the stacked area chart
        svg.selectAll(".layer")
            .data(series)
            .enter().append("path")
            .attr("class", "layer")
            .attr("d", area)
            .style("fill", function(d, i) { return color(d.key); })
            .on("mouseover", mouseover)
            .on("mouseleave", mouseleave);

        // Create and append the x-axis
        const xAxis = svg.append("g")
            .attr("transform", "translate(0," + height * 1.5 + ")") 
            .call(d3.axisBottom(x).tickSize(-height).tickFormat(d3.timeFormat("%Y/%m/%d")).tickValues(filteredData.map(function(d) { return new Date(d.saledate); })))
            // .on("mouseover", mouseover_x)
            // .on("mouseleave", mouseleave_x);


        xAxis.select(".domain").remove();
        xAxis.selectAll("text")
            .style("text-anchor", "end")
            .attr("transform", "rotate(-45)");

        // Add event listeners for x-axis lines
        const xAxisLines = xAxis.selectAll(".tick line")
        .on("mouseover", function(event, d) {
            mouseover_x(event, d);
        })
        .on("mouseleave", mouseleave_x);

        // Create a legend for different types
        const legend = svg.selectAll(".legend")
        .data(['house 2', 'house 3', 'house 4', 'house 5', 'unit 1', 'unit 2', 'unit 3'])
        .enter().append("g")
            .attr("class", "legend")
            .attr("transform", (d, i) => "translate(" + (svgWidth - 200) + "," + (20 * i) + ")");

        legend.append("rect")
            .attr("x", 0)
            .attr("width", 18)
            .attr("height", 18)
            .attr("fill", (d, i) => color(i));

        legend.append("text")
            .attr("x", 25)
            .attr("y", 9)
            .attr("dy", ".35em")
            .style("text-anchor", "start")
            .text(d => d);
        // Create a tooltip for displaying data on hover
        var Tooltip = svg
            .append("text")
            .style("opacity", 0)
            .style("font-size", 12)
            .style("font-weight", "bold");

    //////////// Functions ////////////
        // Function to handle mouseover event on chart area
        function mouseover() {
            Tooltip.style("opacity", 1)
                .attr("x", 10)
                .attr("y", 40);
            d3.selectAll(".layer").style("opacity", 0.2);
            d3.select(this)
                .style("stroke", "black")
                .style("opacity", 1);
        }

        // Function to handle mouseleave event on chart area
        function mouseleave() {
            Tooltip.style("opacity", 0);
            d3.selectAll(".layer")
                .style("opacity", 1)
                .style("stroke", "none");
        }

        // Function to handle mouseover event on x-axis
        function mouseover_x(event, targetDate) {
            var inputDate = new Date(targetDate);

            // Get year, month, and day 
            var year = inputDate.getFullYear();
            var month = (inputDate.getMonth() + 1).toString().padStart(2, '0'); // +1 是因为月份从0开始，padStart 用于补零
            var day = inputDate.getDate().toString().padStart(2, '0');
            
            // Format the date as "YYYY/MM/DD"
            var formattedDate = year + '/' + month + '/' + day;

            var dataPoint = filteredData.filter(function(d) {
                return d.saledate === formattedDate;
            });
            dataPoint = dataPoint[0]

            Tooltip.html("");
            // Add the date to the tooltip
            Tooltip.append("tspan")
                .attr("x", event.offsetX + 10)
                .attr("y", -30)
                .text("Date: " + dataPoint["saledate"]);
            // Add values for selected types
            selectedTypes.forEach(function(type) {
                Tooltip.append("tspan")
                    .attr("x", event.offsetX + 10)
                    .attr("dy", 20) // Increase dy to move text to the next line
                    .text(type + ": " + dataPoint[type]);
            });

        }
        // Function to handle mouseleave event on x-axis
        function mouseleave_x() {
            Tooltip.style("opacity", 0);
        }
    }
})