"use client";

import { useMemo } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { format } from "date-fns";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface Observation {
  scrapedAt: string;
  rateType: string;
  nightlyRate: number;
  totalPrice: number;
}

interface PriceHistoryChartProps {
  observations: Observation[];
}

export function PriceHistoryChart({ observations }: PriceHistoryChartProps) {
  const chartData = useMemo(() => {
    // Sort by date ascending
    const sorted = [...observations].sort(
      (a, b) => new Date(a.scrapedAt).getTime() - new Date(b.scrapedAt).getTime()
    );

    // Group by date and rate type
    const memberData: { x: string; y: number }[] = [];
    const publicData: { x: string; y: number }[] = [];

    sorted.forEach((obs) => {
      const dateLabel = format(new Date(obs.scrapedAt), "MMM d");
      if (obs.rateType === "member") {
        memberData.push({ x: dateLabel, y: obs.totalPrice });
      } else {
        publicData.push({ x: dateLabel, y: obs.totalPrice });
      }
    });

    // Get unique labels
    const labels = Array.from(
      new Set(sorted.map((o) => format(new Date(o.scrapedAt), "MMM d")))
    );

    return {
      labels,
      datasets: [
        {
          label: "Member Rate",
          data: labels.map((label) => {
            const point = memberData.find((d) => d.x === label);
            return point?.y ?? null;
          }),
          borderColor: "#C5A572",
          backgroundColor: "rgba(197, 165, 114, 0.1)",
          fill: true,
          tension: 0.3,
          pointRadius: 4,
          pointHoverRadius: 6,
        },
        {
          label: "Public Rate",
          data: labels.map((label) => {
            const point = publicData.find((d) => d.x === label);
            return point?.y ?? null;
          }),
          borderColor: "#6b7280",
          backgroundColor: "rgba(107, 114, 128, 0.1)",
          fill: true,
          tension: 0.3,
          pointRadius: 4,
          pointHoverRadius: 6,
        },
      ],
    };
  }, [observations]);

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top" as const,
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            return `${context.dataset.label}: $${context.raw?.toFixed(2) ?? "N/A"}`;
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: false,
        ticks: {
          callback: (value: any) => `$${value}`,
        },
      },
    },
    interaction: {
      intersect: false,
      mode: "index" as const,
    },
  };

  if (observations.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-muted-foreground">
        No price data to display
      </div>
    );
  }

  return (
    <div className="h-64">
      <Line data={chartData} options={options} />
    </div>
  );
}
