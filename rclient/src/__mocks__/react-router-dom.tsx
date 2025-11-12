import React from "react";

// Mock react-router-dom for Jest tests
export const BrowserRouter = ({ children }: { children: React.ReactNode }) => (
  <div>{children}</div>
);
export const Routes = ({ children }: { children: React.ReactNode }) => (
  <div>{children}</div>
);
export const Route = ({ children }: { children?: React.ReactNode }) => (
  <div>{children}</div>
);
export const Link = ({
  to,
  children,
  ...props
}: {
  to: string;
  children: React.ReactNode;
  [key: string]: any;
}) => (
  <a href={to} {...props}>
    {children}
  </a>
);
export const useNavigate = () => jest.fn();
export const useLocation = () => ({
  pathname: "/",
  search: "",
  hash: "",
  state: null,
});
export const useParams = () => ({});
export const Navigate = ({ to }: { to: string }) => <div>Navigate to {to}</div>;
export const Outlet = () => <div>Outlet</div>;
