import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { RequireAuth, RequirePermission } from '@/features/auth/components/Guards';
import { PERMISSIONS } from '@/shared/auth/permissions';
import { AppLayout } from '@/shared/components/layout/AppLayout';

const LoginPage = lazy(() =>
  import('@/features/auth/pages/LoginPage').then((m) => ({ default: m.LoginPage })),
);
const NotificationsPage = lazy(() =>
  import('@/features/notifications/pages/NotificationsPage').then((m) => ({
    default: m.NotificationsPage,
  })),
);
const UsersPage = lazy(() =>
  import('@/features/users/pages/UsersPage').then((m) => ({ default: m.UsersPage })),
);
const RolesPage = lazy(() =>
  import('@/features/roles/pages/RolesPage').then((m) => ({ default: m.RolesPage })),
);
const TicketsPage = lazy(() =>
  import('@/features/tickets/pages/TicketsPage').then((m) => ({ default: m.TicketsPage })),
);
const TicketDetailPage = lazy(() =>
  import('@/features/tickets/pages/TicketDetailPage').then((m) => ({ default: m.TicketDetailPage })),
);
const CatalogsRoute = lazy(() =>
  import('@/app/pages/CatalogsRoute').then((m) => ({ default: m.CatalogsRoute })),
);
const ProfilePage = lazy(() =>
  import('@/features/auth/pages/ProfilePage').then((m) => ({ default: m.ProfilePage })),
);
const ModulesPage = lazy(() =>
  import('@/features/roles/pages/ModulesPage').then((m) => ({ default: m.ModulesPage })),
);
const PermissionsPage = lazy(() =>
  import('@/features/roles/pages/PermissionsPage').then((m) => ({ default: m.PermissionsPage })),
);
const AuditPage = lazy(() =>
  import('@/features/audit/pages/AuditPage').then((m) => ({ default: m.AuditPage })),
);
const AnalyticsPage = lazy(() =>
  import('@/features/tickets/pages/AnalyticsPage').then((m) => ({ default: m.AnalyticsPage })),
);
const ReviewPage = lazy(() =>
  import('@/features/tickets/pages/ReviewPage').then((m) => ({ default: m.ReviewPage })),
);
const ReconciliationPage = lazy(() =>
  import('@/features/tickets/pages/ReconciliationPage').then((m) => ({
    default: m.ReconciliationPage,
  })),
);
const PassengersSearchPage = lazy(() =>
  import('@/features/tickets/pages/PassengersSearchPage').then((m) => ({
    default: m.PassengersSearchPage,
  })),
);
const QuickLogPage = lazy(() =>
  import('@/features/tickets/quicklog/QuickLogPage').then((m) => ({ default: m.QuickLogPage })),
);
const RulesPage = lazy(() =>
  import('@/features/tickets/pages/RulesPage').then((m) => ({ default: m.RulesPage })),
);

export function AppRoutes() {
  return (
    <Suspense fallback={null}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
          <Route path="/" element={<Navigate to="/tickets" replace />} />
          <Route path="/avisos" element={<NotificationsPage />} />
          <Route path="/perfil" element={<ProfilePage />} />
          <Route
            path="/tickets"
            element={
              <RequirePermission permission={PERMISSIONS.ticketsView}>
                <TicketsPage />
              </RequirePermission>
            }
          />
          <Route
            path="/tickets/:id"
            element={
              <RequirePermission permission={PERMISSIONS.ticketsView}>
                <TicketDetailPage />
              </RequirePermission>
            }
          />
          <Route
            path="/pasajeros"
            element={
              <RequirePermission permission={PERMISSIONS.passengersView}>
                <PassengersSearchPage />
              </RequirePermission>
            }
          />
          <Route
            path="/bitacora-rapida"
            element={
              <RequirePermission permission={PERMISSIONS.ticketsCreate}>
                <QuickLogPage />
              </RequirePermission>
            }
          />
          <Route
            path="/usuarios"
            element={
              <RequirePermission permission={PERMISSIONS.usersView}>
                <UsersPage />
              </RequirePermission>
            }
          />
          <Route
            path="/roles"
            element={
              <RequirePermission permission={PERMISSIONS.rolesView}>
                <RolesPage />
              </RequirePermission>
            }
          />
          <Route
            path="/modulos"
            element={
              <RequirePermission permission={PERMISSIONS.rolesManage}>
                <ModulesPage />
              </RequirePermission>
            }
          />
          <Route
            path="/permisos"
            element={
              <RequirePermission permission={PERMISSIONS.rolesManage}>
                <PermissionsPage />
              </RequirePermission>
            }
          />
          <Route
            path="/catalogos"
            element={
              <RequirePermission permission={PERMISSIONS.catalogsView}>
                <CatalogsRoute />
              </RequirePermission>
            }
          />
          <Route
            path="/analitica"
            element={
              <RequirePermission permission={PERMISSIONS.analyticsView}>
                <AnalyticsPage />
              </RequirePermission>
            }
          />
          <Route
            path="/auditoria"
            element={
              <RequirePermission permission={PERMISSIONS.auditView}>
                <AuditPage />
              </RequirePermission>
            }
          />
          <Route
            path="/validacion"
            element={
              <RequirePermission permission={PERMISSIONS.reviewValidate}>
                <ReviewPage />
              </RequirePermission>
            }
          />
          <Route
            path="/conciliacion"
            element={
              <RequirePermission permission={PERMISSIONS.analyticsView}>
                <ReconciliationPage />
              </RequirePermission>
            }
          />
          <Route
            path="/reglas"
            element={
              <RequirePermission permission={PERMISSIONS.rulesManage}>
                <RulesPage />
              </RequirePermission>
            }
          />
          <Route path="/tipos-ticket" element={<Navigate to="/catalogos?tipo=ticket_types" replace />} />
          <Route path="/estados" element={<Navigate to="/catalogos?tipo=statuses" replace />} />
        </Route>

        <Route path="/operaciones" element={<Navigate to="/tickets" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
