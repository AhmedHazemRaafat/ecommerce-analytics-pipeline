declare module "react-simple-maps" {
  import type { ReactNode, CSSProperties } from "react";

  export interface GeographyProps {
    geography: unknown;
    onClick?: () => void;
    style?: {
      default?: CSSProperties;
      hover?: CSSProperties;
      pressed?: CSSProperties;
    };
  }

  export function ComposableMap(props: {
    projection?: string;
    projectionConfig?: Record<string, number | number[]>;
    width?: number;
    height?: number;
    style?: CSSProperties;
    children?: ReactNode;
  }): JSX.Element;

  export function Geographies(props: {
    geography: string;
    children: (args: { geographies: Array<{ rsmKey: string; properties: Record<string, unknown> }> }) => ReactNode;
  }): JSX.Element;

  export function Geography(props: GeographyProps): JSX.Element;

  export function ZoomableGroup(props: { children?: ReactNode }): JSX.Element;
}
