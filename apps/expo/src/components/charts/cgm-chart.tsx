import type { SharedValue } from "react-native-reanimated";
import type { ChartBounds } from "victory-native";
import { useMemo } from "react";
import { View } from "react-native";
import { useDerivedValue, useSharedValue } from "react-native-reanimated";
import { Inter_500Medium } from "@expo-google-fonts/inter";
import {
  Circle,
  Line as SkiaLine,
  Text as SKText,
  useFont,
  vec,
} from "@shopify/react-native-skia";
import { CartesianChart, Line, useChartPressState } from "victory-native";

import type { ProcessedActivityData } from "~/stores/activity-store";
import { mockActivityData } from "~/data/activity";
import { mockCGMData } from "~/data/cgm";
import { useColorScheme } from "~/lib/use-color-scheme";
import { useActivityStore } from "~/stores/activity-store";

// Helper function to convert ISO string to hour number
const dateTimeToHour = (dateTimeString: string) => {
  const date = new Date(dateTimeString);
  return date.getHours() + date.getMinutes() / 60;
};

// Helper function to format time
const formatTime = (hour: number) => {
  "worklet";
  const totalMinutes = hour * 60;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.floor(totalMinutes % 60);
  const ampm = hours >= 12 ? "PM" : "AM";
  const formattedHours = hours % 12 || 12;
  const formattedMinutes = minutes.toString().padStart(2, "0");
  return `${formattedHours}:${formattedMinutes} ${ampm}`;
};

const activityTypeToEmoji = {
  sleep: "🛌",
  exercise: "🏋️",
  nutrition: "🍽️",
  work: "💼",
  leisure: "🎭",
};

export default function CGMChart() {
  const { colorScheme } = useColorScheme();
  const { selectedActivity, setSelectedActivity } = useActivityStore();
  const font = useFont(Inter_500Medium, 12);

  // Preprocess the data to use hour numbers for x-axis
  const processedData = useMemo(
    () =>
      mockCGMData.map((item) => ({
        ...item,
        hour: dateTimeToHour(item.dateTime),
      })),
    [],
  );

  const processedActivityData = useMemo(
    () =>
      mockActivityData.map((item) => ({
        ...item,
        hour: dateTimeToHour(item.dateTime),
      })),
    [],
  );

  const { state, isActive } = useChartPressState({
    x: 0,
    y: { amount: 0 },
  });

  const selectedActivityIndex = useSharedValue<number | null>(null);

  useDerivedValue(() => {
    if (isActive) {
      const pressedXValue = state.x.value.value;
      const nearestActivityIndex = processedActivityData.reduce(
        (nearest, current, index) => {
          const currentDiff = Math.abs(current.hour - pressedXValue);
          const nearestDiff = Math.abs(
            processedActivityData[nearest].hour - pressedXValue,
          );
          return currentDiff < nearestDiff ? index : nearest;
        },
        0,
      );

      if (
        Math.abs(
          processedActivityData[nearestActivityIndex].hour - pressedXValue,
        ) <= 0.5
      ) {
        selectedActivityIndex.value = nearestActivityIndex;
      } else {
        selectedActivityIndex.value = null;
      }
    } else {
      selectedActivityIndex.value = null;
    }
  }, [isActive, state.x.value]);

  const labelColor = colorScheme === "dark" ? "white" : "black";
  const lineColor =
    colorScheme === "dark"
      ? {
          grid: {
            x: "black",
            y: "rgba(211, 211, 211, 0.5)",
          },
          frame: "black",
        }
      : {
          grid: {
            x: "white",
            y: "black",
          },
          frame: "white",
        };

  return (
    <View className="h-80 w-full">
      <CartesianChart
        data={processedData}
        xKey="hour"
        yKeys={["amount"]}
        domainPadding={{ top: 30 }}
        gestureLongPressDelay={0}
        axisOptions={{
          font,
          labelColor,
          lineColor,
          axisSide: { x: "bottom", y: "right" },
          tickCount: {
            x: 3,
            y: 4,
          },
          tickValues: {
            x: [0, 6, 12, 18, 24],
            y: [40, 70, 110, 140, 180, 240],
          },
          formatXLabel: (value) => {
            const hour = Number(value);
            if (hour === 6) return "6 AM";
            if (hour === 12) return "12 PM";
            if (hour === 18) return "6 PM";
            return "";
          },
          formatYLabel: (value) => {
            const showLabels = [70, 110, 140, 180, 240];
            return showLabels.includes(value) ? `${value}` : "";
          },
          labelOffset: { x: 8, y: 8 },
        }}
        chartPressState={state}
      >
        {({ points, chartBounds }) => (
          <>
            <Line
              points={points.amount}
              color="lightgreen"
              strokeWidth={3}
              animate={{ type: "timing", duration: 500 }}
              connectMissingData={false}
            />
            {processedActivityData.map((activity, index) => (
              <ActivityIndicator
                key={index}
                activity={activity}
                chartBounds={chartBounds}
                isSelected={selectedActivityIndex.value === index}
              />
            ))}
            {(isActive || selectedActivity) && (
              <ActiveValueIndicator
                xPosition={
                  selectedActivity ? selectedActivity.hour : state.x.position
                }
                yPosition={state.y.amount.position}
                activeValue={state.y.amount.value}
                activeTime={
                  selectedActivity ? selectedActivity.hour : state.x.value
                }
                bottom={chartBounds.bottom}
                top={chartBounds.top}
                textColor={labelColor}
                lineColor={lineColor.grid.y}
                indicatorColor="lightgreen"
              />
            )}
          </>
        )}
      </CartesianChart>
    </View>
  );
}

const ActivityIndicator = (props: {
  activity: ProcessedActivityData;
  chartBounds: ChartBounds;
  isSelected: boolean;
}) => {
  const { activity, chartBounds, isSelected } = props;

  const xPosition =
    (activity.hour / 24) * (chartBounds.right - chartBounds.left) +
    chartBounds.left;
  const yPosition = chartBounds.bottom - 20; // Place it slightly above the bottom of the chart

  return (
    <>
      <Circle
        cx={xPosition}
        cy={yPosition}
        r={isSelected ? 15 : 10}
        color={isSelected ? "rgba(0, 255, 0, 0.5)" : "rgba(200, 200, 200, 0.5)"}
      />
      <SKText
        x={xPosition - 10}
        y={yPosition + 5}
        text={activityTypeToEmoji[activity.type]}
        font={useFont(Inter_500Medium, 20)}
      />
    </>
  );
};

const ActiveValueIndicator = (props: {
  xPosition: number | SharedValue<number>;
  yPosition: SharedValue<number>;
  activeValue: SharedValue<number>;
  activeTime: number | SharedValue<number>;
  bottom: number;
  top: number;
  textColor: string;
  lineColor: string;
  indicatorColor: string;
}) => {
  const {
    xPosition,
    yPosition,
    activeValue,
    activeTime,
    bottom,
    top,
    textColor,
    lineColor,
    indicatorColor,
  } = props;

  const VALUE_FONT_SIZE = 16;
  const TIME_FONT_SIZE = 14;
  const valueFont = useFont(Inter_500Medium, VALUE_FONT_SIZE);
  const timeFont = useFont(Inter_500Medium, TIME_FONT_SIZE);

  const xPos = useDerivedValue(() => {
    return typeof xPosition === "number" ? xPosition : xPosition.value;
  });

  const start = useDerivedValue(() => vec(xPos.value, bottom));
  const end = useDerivedValue(() =>
    vec(xPos.value, top + 2.5 * VALUE_FONT_SIZE),
  );

  // Value label
  const activeValueDisplay = useDerivedValue(
    () => activeValue.value.toFixed(0) + " mg/dL",
  );
  const activeValueWidth = useDerivedValue(
    () => valueFont?.measureText(activeValueDisplay.value).width ?? 0,
  );
  const activeValueX = useDerivedValue(
    () => xPos.value - activeValueWidth.value / 2,
  );

  // Time label
  const activeTimeDisplay = useDerivedValue(() =>
    formatTime(typeof activeTime === "number" ? activeTime : activeTime.value),
  );
  const activeTimeWidth = useDerivedValue(
    () => timeFont?.measureText(activeTimeDisplay.value).width ?? 0,
  );
  const activeTimeX = useDerivedValue(
    () => xPos.value - activeTimeWidth.value / 2,
  );

  return (
    <>
      <SkiaLine p1={start} p2={end} color={lineColor} strokeWidth={1} />
      <Circle cx={xPosition} cy={yPosition} r={10} color={indicatorColor} />
      <Circle
        cx={xPosition}
        cy={yPosition}
        r={8}
        color="hsla(0, 0, 100%, 0.25)"
      />
      <SKText
        color={textColor}
        font={timeFont}
        text={activeTimeDisplay}
        x={activeTimeX}
        y={top + TIME_FONT_SIZE}
      />
      <SKText
        color={textColor}
        font={valueFont}
        text={activeValueDisplay}
        x={activeValueX}
        y={top + TIME_FONT_SIZE + VALUE_FONT_SIZE + 4}
      />
    </>
  );
};
