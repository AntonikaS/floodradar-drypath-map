declare module "esri-leaflet" {
  import * as L from "leaflet";

  export type BasemapKey =
    | "Imagery"
    | "ImageryTransportation"
    | "ImageryLabels"
    | (string & {});

  export function basemapLayer(
    key: BasemapKey,
    options?: L.TileLayerOptions,
  ): L.TileLayer;

  export interface DynamicMapLayerOptions extends L.LayerOptions {
    url: string;
    opacity?: number;
    format?: string;
    transparent?: boolean;
    layers?: number[];
    useCors?: boolean;
    dynamicLayers?: Array<Record<string, unknown>>;
  }

  export interface DynamicMapLayer extends L.Layer {
    setOpacity(opacity: number): this;
    setZIndex(zIndex: number): this;
    setLayers(layers: number[]): this;
    setDynamicLayers(layers: Array<Record<string, unknown>>): this;
  }

  export function dynamicMapLayer(
    url: string,
    options?: Omit<DynamicMapLayerOptions, "url">,
  ): DynamicMapLayer;

  export function dynamicMapLayer(
    options: DynamicMapLayerOptions,
  ): DynamicMapLayer;
}
