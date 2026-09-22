import React, { useState } from "react";
import { LayoutChangeEvent, StyleSheet, View, ViewStyle } from "react-native";
import Svg, { Polygon, Rect } from "react-native-svg";

export type SacrificeShapeType = "square" | "triangle" | "none";

export type SacrificeShapeContainerProps = {
  shape?: SacrificeShapeType;
  color?: string;
  strokeWidth?: number;
  padding?: number;
  style?: ViewStyle;
  children: React.ReactNode;
};

/**
 * 早稻田外框修飾容器：
 * - 犧牲短打：擊球事件加上藍色方框
 * - 高飛犧牲打：擊球事件加上藍色三角框
 * 動態透過 onLayout 計算文字尺寸並繪製自適應向量外框。
 */
export function SacrificeShapeContainer({
  shape = "none",
  color = "#1D5FA7",
  strokeWidth = 1.5,
  padding = 3,
  style,
  children,
}: SacrificeShapeContainerProps) {
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (Math.abs(width - dimensions.width) > 0.5 || Math.abs(height - dimensions.height) > 0.5) {
      setDimensions({ width, height });
    }
  };

  if (shape === "none") {
    return <View style={style}>{children}</View>;
  }

  const svgWidth = Math.max(dimensions.width + padding * 2, 14);
  const svgHeight = Math.max(dimensions.height + padding * 2, 14);

  // 三角形三個頂點：頂部中點、右下點、左下點
  const trianglePoints = `${svgWidth / 2},${strokeWidth} ${svgWidth - strokeWidth},${svgHeight - strokeWidth} ${strokeWidth},${svgHeight - strokeWidth}`;

  return (
    <View style={[styles.container, style]} onLayout={onLayout}>
      {dimensions.width > 0 && dimensions.height > 0 && (
        <Svg
          width={svgWidth}
          height={svgHeight}
          style={[
            styles.svgOverlay,
            {
              left: -padding,
              top: -padding,
            },
          ]}
          pointerEvents="none"
        >
          {shape === "square" && (
            <Rect
              x={strokeWidth / 2}
              y={strokeWidth / 2}
              width={svgWidth - strokeWidth}
              height={svgHeight - strokeWidth}
              stroke={color}
              strokeWidth={strokeWidth}
              fill="transparent"
            />
          )}
          {shape === "triangle" && (
            <Polygon
              points={trianglePoints}
              stroke={color}
              strokeWidth={strokeWidth}
              fill="transparent"
            />
          )}
        </Svg>
      )}
      <View style={{ paddingHorizontal: shape === "triangle" ? 3 : 1 }}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  svgOverlay: {
    position: "absolute",
  },
});
