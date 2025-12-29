(function() {
    "use strict";

    // =================================================================================
    // PART 1: BUILDER PANEL (Design Mode)
    // =================================================================================
    
    const builderTemplate = document.createElement("template");
    builderTemplate.innerHTML = `
        <style>
            :host {
                display: block;
                padding: 15px;
                font-family: "72", "Segoe UI", Arial, sans-serif; /* SAP Fiori Font */
            }
            .form-group {
                margin-bottom: 15px;
            }
            label {
                display: block;
                margin-bottom: 5px;
                font-size: 12px;
                font-weight: bold;
                color: #333;
            }
            input[type="text"] {
                width: 100%;
                padding: 8px;
                border: 1px solid #ccc;
                border-radius: 4px;
                box-sizing: border-box; /* Ensures padding doesn't expand width */
                font-size: 13px;
            }
            button {
                background-color: #0a6ed1;
                color: white;
                border: none;
                padding: 10px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 13px;
                width: 100%;
                font-weight: bold;
            }
            button:hover {
                background-color: #0854a0;
            }
            .hint {
                font-size: 11px;
                color: #666;
                margin-top: 5px;
                font-style: italic;
            }
        </style>
        <form id="form">
            <div class="form-group">
                <label for="widget_title">Widget Title</label>
                <input id="widget_title" type="text" placeholder="e.g. Current & Non-current">
            </div>
            <button type="submit">Update Widget</button>
            <div class="hint">Click update to apply changes to the canvas.</div>
        </form>
    `;

    class FinancialBalanceChartBuilder extends HTMLElement {
        constructor() {
            super();
            this.attachShadow({ mode: "open" });
            this.shadowRoot.appendChild(builderTemplate.content.cloneNode(true));
        }

        connectedCallback() {
            this.shadowRoot.getElementById("form").addEventListener("submit", this._submit.bind(this));
        }

        _submit(e) {
            e.preventDefault();
            // Dispatch event to notify SAC that properties have changed
            this.dispatchEvent(new CustomEvent("propertiesChanged", {
                detail: {
                    properties: {
                        widgetTitle: this.widgetTitle
                    }
                }
            }));
        }

        // Getter/Setter linked to the input field
        get widgetTitle() {
            return this.shadowRoot.getElementById("widget_title").value;
        }

        set widgetTitle(val) {
            this.shadowRoot.getElementById("widget_title").value = val;
        }
    }

    // =================================================================================
    // PART 2: MAIN WIDGET (Runtime & Canvas)
    // =================================================================================

    const chartTemplate = document.createElement("template");
    chartTemplate.innerHTML = `
        <style>
            :host {
                display: block;
                font-family: '72', 'Segoe UI', Arial, sans-serif;
                color: #32363a;
                width: 100%;
                height: 100%;
            }
            .container {
                display: flex;
                flex-direction: column;
                height: 100%;
                padding: 10px;
                box-sizing: border-box;
                background-color: transparent; 
            }
            
            /* Header Section */
            .header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 25px;
                flex-shrink: 0; /* Prevents header from shrinking */
            }
            .title {
                font-size: 18px;
                font-weight: 700;
                color: #32363a;
            }
            .legend {
                display: flex;
                gap: 15px;
                font-size: 13px;
                color: #6a6d70;
            }
            .legend-item {
                display: flex;
                align-items: center;
                gap: 6px;
            }
            .dot { width: 8px; height: 8px; border-radius: 50%; }
            .dot.current { background-color: #32363a; }
            .dot.non-current { background-color: #b0b0b0; }

            /* Chart Body */
            .chart-body {
                flex-grow: 1;
                overflow-y: auto; /* Allows scrolling if many rows */
            }

            .chart-row { 
                margin-bottom: 25px; 
            }
            
            .labels-row {
                display: flex;
                justify-content: space-between;
                font-size: 14px;
                margin-bottom: 8px;
                color: #32363a;
            }
            .category-label { font-weight: 600; color: #555; }
            
            /* Bar Styling - Rounded Pills */
            .bar-container {
                display: flex;
                height: 12px;
                width: 100%;
                background-color: #efefef;
                border-radius: 50px; /* Pill shape */
                overflow: hidden;
                cursor: pointer;
                box-shadow: inset 0 1px 2px rgba(0,0,0,0.05);
            }
            .bar-segment {
                height: 100%;
                /* Smooth animation for width changes */
                transition: width 0.8s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.2s;
                width: 0%; /* Start at 0 for animation */
                position: relative;
            }
            .bar-current { background-color: #32363a; }
            .bar-non-current { background-color: #b0b0b0; }

            /* Hover Interaction */
            .bar-container:hover .bar-segment { opacity: 0.85; }
            .bar-segment:hover { opacity: 1 !important; filter: brightness(1.1); }

            /* Tooltip - Self Contained (No external library) */
            #tooltip {
                position: fixed; /* Fixed to viewport to avoid overflow issues */
                background: rgba(40, 40, 40, 0.95);
                backdrop-filter: blur(2px);
                color: white;
                padding: 8px 12px;
                border-radius: 4px;
                font-size: 12px;
                pointer-events: none; /* Mouse passes through */
                opacity: 0;
                transition: opacity 0.2s;
                z-index: 9999;
                white-space: nowrap;
                box-shadow: 0 4px 10px rgba(0,0,0,0.2);
            }
        </style>
        
        <div class="container">
            <!-- Header -->
            <div class="header">
                <div class="title" id="chartTitle">Current & Non-current</div>
                <div class="legend">
                    <div class="legend-item"><div class="dot current"></div>Current</div>
                    <div class="legend-item"><div class="dot non-current"></div>Non-current</div>
                </div>
            </div>

            <!-- Rows container -->
            <div class="chart-body" id="chartBody"></div>

            <!-- Tooltip element -->
            <div id="tooltip"></div>
        </div>
    `;

    class FinancialBalanceChart extends HTMLElement {
        constructor() {
            super();
            this.attachShadow({ mode: "open" });
            this.shadowRoot.appendChild(chartTemplate.content.cloneNode(true));
            
            // Default properties
            this._props = {
                widgetTitle: "Current & Non-current",
                chartData: [] // Default empty
            };
        }

        // SAC Lifecycle: Triggered when properties are updated in the side panel or via script
        onCustomWidgetBeforeUpdate(changedProperties) {
            this._props = { ...this._props, ...changedProperties };
        }

        // SAC Lifecycle: Triggered after the update is committed
        onCustomWidgetAfterUpdate(changedProperties) {
            
            // 1. Update Title
            if ("widgetTitle" in changedProperties) {
                this.shadowRoot.getElementById("chartTitle").textContent = this._props.widgetTitle;
            }

            // 2. Update Data
            if ("chartData" in changedProperties) {
                this.renderChart(this._props.chartData);
            }
        }

        renderChart(rawData) {
            const chartBody = this.shadowRoot.getElementById("chartBody");
            
            // Handle data (parse string if necessary)
            let data = [];
            try {
                if (typeof rawData === "string") {
                    data = JSON.parse(rawData);
                } else {
                    data = rawData;
                }
            } catch (e) {
                chartBody.innerHTML = `<div style="color:red; padding:10px;">Error parsing JSON data</div>`;
                return;
            }

            if (!data || data.length === 0) {
                chartBody.innerHTML = `<div style="padding:10px; color:#999; font-style:italic">No data configured.</div>`;
                return;
            }

            // Generate HTML
            const html = data.map((item) => {
                // Parse values safely (handle string or number inputs)
                const valCurrent = parseFloat(item.current) || 0;
                const valNonCurrent = parseFloat(item.nonCurrent) || 0;
                const total = valCurrent + valNonCurrent;
                
                // Calculate percentages
                const currentPct = total > 0 ? ((valCurrent / total) * 100).toFixed(1) : 0;
                const nonCurrentPct = total > 0 ? ((valNonCurrent / total) * 100).toFixed(1) : 0;

                // Create the DOM structure for one row
                return `
                <div class="chart-row">
                    <div class="labels-row">
                        <span>${valCurrent}Bln (${Math.round(currentPct)}%)</span>
                        <span class="category-label">${item.label}</span>
                        <span>${valNonCurrent}Bln (${Math.round(nonCurrentPct)}%)</span>
                    </div>
                    <div class="bar-container">
                        <div class="bar-segment bar-current" 
                             style="width: ${currentPct}%"
                             data-type="Current"
                             data-category="${item.label}"
                             data-value="${valCurrent}"
                             data-percent="${currentPct}">
                        </div>
                        <div class="bar-segment bar-non-current" 
                             style="width: ${nonCurrentPct}%"
                             data-type="Non-current"
                             data-category="${item.label}"
                             data-value="${valNonCurrent}"
                             data-percent="${nonCurrentPct}">
                        </div>
                    </div>
                </div>
                `;
            }).join('');

            chartBody.innerHTML = html;
            
            // Add interaction listeners after rendering new HTML
            this._addInteractivity();
        }

        _addInteractivity() {
            const tooltip = this.shadowRoot.getElementById("tooltip");
            const segments = this.shadowRoot.querySelectorAll(".bar-segment");

            segments.forEach(segment => {
                // 1. Mouse Enter
                segment.addEventListener("mouseenter", (e) => {
                    const d = e.target.dataset;
                    tooltip.innerHTML = `
                        <div style="font-weight:bold; margin-bottom:2px">${d.category} (${d.type})</div>
                        <div>Value: ${d.value} Bln</div>
                        <div style="opacity:0.8; font-size:11px">${d.percent}% Share</div>
                    `;
                    tooltip.style.opacity = "1";
                });

                // 2. Mouse Move (Follow cursor)
                segment.addEventListener("mousemove", (e) => {
                    const x = e.clientX; 
                    const y = e.clientY - 45; // Position slightly above cursor
                    tooltip.style.left = `${x}px`;
                    tooltip.style.top = `${y}px`;
                });

                // 3. Mouse Leave
                segment.addEventListener("mouseleave", () => {
                    tooltip.style.opacity = "0";
                });

                // 4. Click Event (Dispatch to SAC)
                segment.addEventListener("click", (e) => {
                    const d = e.target.dataset;
                    this.dispatchEvent(new CustomEvent("onBarClick", {
                        detail: {
                            category: d.category,
                            type: d.type,
                            value: parseFloat(d.value)
                        }
                    }));
                });
            });
        }

        // --- SAC Scripting Interface ---
        // These are methods you can call from SAC scripts
        setChartData(newData) {
            this.renderChart(newData);
        }
    }

    // =================================================================================
    // PART 3: REGISTER CUSTOM ELEMENTS
    // =================================================================================
    customElements.define("financial-balance-chart", FinancialBalanceChart);
    customElements.define("financial-balance-chart-builder", FinancialBalanceChartBuilder);

})();