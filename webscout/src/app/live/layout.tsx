import DashboardLayout from "@/app/dashboard/layout";

export default function LiveLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardLayout>{children}</DashboardLayout>;
}
