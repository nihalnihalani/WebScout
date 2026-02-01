import DashboardLayout from "@/app/dashboard/layout";

export default function PatternsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardLayout>{children}</DashboardLayout>;
}
