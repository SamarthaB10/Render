import type { WidgetChild, WidgetChildren, WidgetComponentProps, WidgetNode } from "./index.ts";

export type WidgetComponent<Props extends WidgetComponentProps = WidgetComponentProps> = (props: Props) => WidgetNode;
export type WidgetElementType = WidgetComponent<any>;

export interface FragmentProps extends WidgetComponentProps {}

/** Groups JSX children into a native Box when more than one child is returned. */
export function Fragment(props: FragmentProps): WidgetNode {
  const children = childrenFrom(props.children);
  return children.length === 1 ? children[0] : { kind: "box", children };
}

export function jsx(
  type: WidgetElementType,
  props: WidgetComponentProps & Record<string, unknown>,
  key?: string | number
): WidgetNode {
  const node = type(props);
  return key === undefined ? node : { ...node, key };
}

export const jsxs = jsx;

/**
 * The JSX namespace intentionally has no intrinsic HTML elements. Widget authors
 * use exported Render components so every node remains a serializable native
 * contract instead of becoming DOM or CSS.
 */
export namespace JSX {
  export type Element = WidgetNode;
  export type ElementType = WidgetElementType;
  export interface ElementChildrenAttribute {
    children: {};
  }
  export interface IntrinsicElements {}
}

function childrenFrom(children: WidgetChildren | undefined): WidgetNode[] {
  if (children === undefined || children === null || typeof children === "boolean") return [];
  if (Array.isArray(children)) return children.flatMap((child) => childrenFrom(child));
  if (typeof children === "string" || typeof children === "number") {
    return [{ kind: "text", text: String(children) }];
  }
  return [children as WidgetChild & WidgetNode];
}
