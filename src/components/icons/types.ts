// Types for animated icons from itshover.com
import { SVGProps } from "react";

export interface AnimatedIconProps extends Omit<
  SVGProps<SVGSVGElement>,
  "ref"
> {
  size?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
}

export interface AnimatedIconHandle {
  startAnimation: () => void | Promise<void>;
  stopAnimation: () => void | Promise<void>;
}
