import { Component, type ReactNode } from "react";

/** Catches render/runtime errors in a subtree (e.g. WebGL context failure in
 *  the 3D canvas) and swaps in a fallback instead of white-screening the app. */
export default class ErrorBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error("[ErrorBoundary]", error);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
