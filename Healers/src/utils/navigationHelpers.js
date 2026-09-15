
export const getInitialRouteByRole = (role) => {
  switch (role) {
    case 'Admin':
      return 'AdminDashboard';
    case 'Therapist':
    case 'Doctor':
      return 'DoctorPortal';
    case 'Child':
    default:
      return 'ChildDashboard';
  }
};