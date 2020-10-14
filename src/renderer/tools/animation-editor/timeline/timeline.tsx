import { Nullable } from "../../../../shared/types";

import * as React from "react";

import { Chart, ChartPoint } from "chart.js";
import "chartjs-plugin-dragdata";
import "chartjs-plugin-zoom";
import "chartjs-plugin-annotation";

import { Animation, IAnimatable } from "babylonjs";

import Editor from "../../../editor";

import { IVector2Like } from "../tools/augmentations";

export interface ITimelineEditorProps {
    /**
     * Defines the reference to the editor.
     */
    editor: Editor;
    /**
     * Defines the callback called on a key has been udpated.
     */
    onUpdatedKey: () => void;
}

export interface ITimelineEditorState {
    /**
     * Defines the reference to the selected animatable.
     */
    selectedAnimatable: Nullable<IAnimatable>;
}

export class TimelineEditor extends React.Component<ITimelineEditorProps, ITimelineEditorState> {
    /**
     * Defines the reference to the chart.
     */
    public chart: Nullable<Chart> = null;

    private _canvas: Nullable<HTMLCanvasElement> = null;
    private _refHandler = {
        getCanvas: (ref: HTMLCanvasElement) => this._canvas = ref,
    };

    private _editor: Editor;

    private _panDisabled: boolean = false;
    private _isOverTimeTracker: boolean = false;
    private _draggingTimeTracker: boolean = false;

    private _yValue: number = 0;

    /**
     * Construcor.
     * @param props defines the compoenent's props.
     */
    public constructor(props: ITimelineEditorProps) {
        super(props);

        this._editor = props.editor;
        this.state = {
            selectedAnimatable: null,
        };
    }

    /**
     * Renders the component.
     */
    public render(): React.ReactNode {
        return (
            <div style={{ position: "absolute", width: "calc(100% - 10px)", height: "calc(100% - 50px)" }}>
                <canvas
                    ref={this._refHandler.getCanvas}
                    onMouseDown={(ev) => this._handleMouseDown(ev)}
                    onMouseMove={(ev) => this._handleMouseMove(ev)}
                    onMouseUp={(ev) => this._handleMouseUp(ev)}
                ></canvas>
            </div>
        );
    }

    /**
     * Called on the component did mount.
     */
    public componentDidMount(): void {
        if (!this._canvas) { return; }

        this.chart = new Chart(this._canvas.getContext("2d")!, {
            type: "line",
            data: {
                datasets: [/*{
                    label: "x",
                    borderWidth: 1,
                    backgroundColor: "rgb(189, 80, 105, 1)",
                    pointHitRadius: 25,
                    data: [{
                        x: 10,
                        y: 15,
                        r: 30
                    }],
                }*/],
            },
            options: {
                dragData: true,
                dragX: true,
                onDragStart: (_, e) => this._handleDragPointStart(e),
                onDrag: (e, di, i, v) => this._handleDragPoint(e, di, i, v),
                onDragEnd: (e, di, i, v) => this._handleDragPointEnd(e, di, i, v),
                showLines: false,
                responsive: true,
                maintainAspectRatio: false,
                animation: {
                    duration: 0,
                },
                tooltips: {
                    caretPadding: 15,
                    mode: "point",
                },
                annotation: {
                    events: ["mouseenter", "mouseleave"],
                    annotations: [{
                        drawTime: "afterDatasetsDraw",
                        id: "time-tracker",
                        type: "line",
                        mode: "vertical",
                        scaleID: "x-axis-0",
                        value: 0,
                        borderColor: "#111111",
                        boderWidth: 5,
                        label: {
                            enabled: true,
                            content: "Time",
                            position: "top",
                            backgroundColor: "#333333"
                        },
                        onMouseenter: () => {
                            this._isOverTimeTracker = true;
                            this._panDisabled = true;

                            this._getTimeTracker().borderColor = "#000000";
                            this._getTimeTracker().label.backgroundColor = "#000000";
                            this.chart!.update();
                        },
                        onMouseleave: () => {
                            this._isOverTimeTracker = false;
                            this._panDisabled = false;

                            this._getTimeTracker().borderColor = "#111111";
                            this._getTimeTracker().label.backgroundColor = "#333333";
                            this.chart!.update();
                        },
                    }],
                },
                plugins: {
                    zoom: {
                        pan: {
                            enabled: true,
                            rangeMin: { x: -1, y: 0, },
                            mode: () => this._panDisabled ? "" : "xy",
                        },
                        zoom: {
                            enabled: true,
                            rangeMin: { x: -1,  y: 0 },
                            mode: () => "x",
                        },
                    },
                },
                scales: {
                    xAxes: [{
                        type: "linear",
                        position: "top",
                        ticks: {
                            min: -1,
                            max: 60,
                            fontSize: 12,
                            fontStyle: "bold",
                            fontColor: "#222222",
                            stepSize: 1,
                        },
                    }],
                    yAxes: [{
                        type: "linear",
                        position: "left",
                        ticks: {
                            min: 0,
                            max: 20,
                            reverse: true,
                            stepSize: 1,
                            fontSize: 14,
                            fontStyle: "bold",
                            fontColor: "#222222",
                            beginAtZero: true,
                            showLabelBackdrop: true,
                            labelOffset: 15,
                        },
                    }],
                }
            },
        });
    }

    /**
     * Called on the component will unmount.
     */
    public componentWillUnmount(): void {
        // Destroy chart
        try {
            this.chart?.destroy();
        } catch (e) {
            this._editor.console.logError("[Animation Editor]: failed to destroy chart.");
        }
    }

    /**
     * Sets the new animatable to edit.
     * @param animatable defines the reference to the animatable.
     */
    public setAnimatable(animatable: IAnimatable): void {
        this.setState({ selectedAnimatable: animatable });

        if (!this.chart) { return; }

        this.chart.data.datasets = [];
        this.chart.config.options!.annotation.annotations = [this.chart.config.options!.annotation.annotations[0]];
        this.chart.config.options!.scales!.yAxes![0].ticks!.callback = () => "";

        if (!animatable.animations?.length) {
            this.chart.update(0);
            return;
        }

        animatable.animations.forEach((a, index) => {
            const data: ChartPoint[] = [];
            const keys = a.getKeys();

            keys.forEach((k) => {
                data.push({ x: k.frame, y: 0.5 + index, r: 10 } as ChartPoint);
            });

            this.chart!.data.datasets!.push({
                data,
                label: a.name,
                borderWidth: 1,
                backgroundColor: "rgb(189, 80, 105, 1)",
                xAxisID: "x-axis-0",
                pointRadius: 10,
                pointHitRadius: 15,
            });
        });

        this.chart.config.options!.scales!.yAxes![0].ticks!.callback = (_, index) => {
            return animatable.animations![index]?.name;
        };

        this.chart.update();
    }

    /**
     * Called on an element of the chart is starting being dragged.
     */
    private _handleDragPointStart(element: any): void {
        if (!this.chart?.data?.datasets) { return; }

        this._panDisabled = true;
        this._yValue = this.chart.data.datasets[element["_datasetIndex"]]!.data![element["_index"]]["y"];
    }

    /**
     * Called on an element of the chart is being dragged.
     */
    private _handleDragPoint(_: MouseEvent, datasetIndex: number, index: number, value: IVector2Like): void {
        if (!this.chart?.data?.datasets) { return; }

        this.chart.data.datasets[datasetIndex]!.data![index]["y"] = this._yValue;

        if (index === 0) {
            this.chart.data.datasets[datasetIndex]!.data![index]["x"] = 0;
            return;
        }

        if (this.state.selectedAnimatable?.animations) {
            const animation = this.state.selectedAnimatable.animations[datasetIndex];
            if (animation) {
                this._updateKey(animation, index, value.x);
            }
        }

        this.props.onUpdatedKey();
    }

    /**
     * Callback called on an element stops being dragged.
     */
    private _handleDragPointEnd(_: MouseEvent, datasetIndex: number, index: number, value: IVector2Like): void {
        this._panDisabled = false;

        if (index === 0) { return; }

        // Sort animation
        if (this.state.selectedAnimatable?.animations) {
            const animation = this.state.selectedAnimatable.animations[datasetIndex];
            if (animation) {
                this._updateKey(animation, index, value.x);

                const keys = animation.getKeys();
                keys.sort((a, b) => a.frame - b.frame);
            }
        }

        this.props.onUpdatedKey();
    }

    /**
     * Updates the currently drgged key.
     */
    private _updateKey(animation: Animation, keyIndex: number, value: number): void {
        const keys = animation.getKeys();
        const key = keys[keyIndex];

        if (key) {
            key.frame = value;
        }
    }

    /**
     * Called on the mouse is down on the canvas.
     */
    private _handleMouseDown(_: React.MouseEvent<HTMLCanvasElement, MouseEvent>): void {
        this._draggingTimeTracker = this._isOverTimeTracker;

        if (this._draggingTimeTracker) {
            this._panDisabled = true;
        }
    }

    /**
     * Called on the mouse moves on the canvas.
     */
    private _handleMouseMove(ev: React.MouseEvent<HTMLCanvasElement, MouseEvent>): void {
        if (this._draggingTimeTracker) {
            const positionOnChart = this._getPositionOnChart(ev.nativeEvent);

            if (positionOnChart && this.chart) {
                this._getTimeTracker().value = Math.max(0, positionOnChart.x);
                this.chart.update(0);
            }
        }
    }

    /**
     * Called on the mouse is up on the canvas.
     */
    private _handleMouseUp(_: React.MouseEvent<HTMLCanvasElement, MouseEvent>): void {
        if (this._draggingTimeTracker) {
            this._draggingTimeTracker = false;
        }

        if (!this._isOverTimeTracker) {
            this._panDisabled = false;
        }
    }

    /**
     * Returns the position on the chart according to the given mouse event.
     */
    private _getPositionOnChart(ev: MouseEvent): Nullable<IVector2Like> {
        if (!this.chart) { return null; }

        const x = this.chart["scales"]["x-axis-0"].getValueForPixel(ev.offsetX);
        const y = this.chart["scales"]["y-axis-0"].getValueForPixel(ev.offsetY);

        return { x, y };
    }

    /**
     * Returns the time tracker.
     */
    private _getTimeTracker(): any {
        return this.chart!["annotation"].elements["time-tracker"].options;
    }
}
