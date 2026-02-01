import DashboardLayout from "@/app/dashboard/layout";

export default function TeachLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardLayout>{children}</DashboardLayout>;
}
