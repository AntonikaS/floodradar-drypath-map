import * as L from "leaflet";

declare module "leaflet" {
  namespace Control {
    interface SideBySide extends L.Control {
      setLeftLayers(...layers: Array<L.Layer | L.Layer[]>): this;
      setRightLayers(...layers: Array<L.Layer | L.Layer[]>): this;
      getPosition(): number;
      on(
        type: "dividermove",
        fn: (event: { x: number }) => void,
        context?: unknown,
      ): this;
      off(
        type: "dividermove",
        fn: (event: { x: number }) => void,
        context?: unknown,
      ): this;
      on(type: string, fn: L.LeafletEventHandlerFn, context?: unknown): this;
      off(type: string, fn: L.LeafletEventHandlerFn, context?: unknown): this;
    }
  }

  namespace control {
    function sideBySide(
      leftLayer: L.Layer | L.Layer[],
      rightLayer: L.Layer | L.Layer[],
    ): Control.SideBySide;
  }
}

declare module "leaflet-side-by-side" {
  export {};
}
