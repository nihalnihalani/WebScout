import DashboardLayout from "@/app/dashboard/layout";

export default function TasksLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardLayout>{children}</DashboardLayout>;
}
