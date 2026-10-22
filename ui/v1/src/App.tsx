import {createHashRouter, Navigate, RouterProvider} from "react-router";
import MainLayout from "./layouts/MainLayout.tsx";
import ErrorPage from "./pages/ErrorPage.tsx";
import {usePreferences} from "./stores/usePreferences.ts";
import {useEffect} from "react";
import ContractFormPage from "./pages/ContractFormPage.tsx";
import {contractLoader, contractsLoader, contractFormLoader} from "./loader/contracts.ts";
import {contractAction} from "./actions/contracts.ts";
import ContractPage from "./pages/ContractPage.tsx";
import SettingsPage from "./pages/SettingsPage.tsx";
import LoginPage from "./pages/LoginPage.tsx";
import ChangePasswordPage from "./pages/ChangePasswordPage.tsx";
import UsersPage from "./pages/UsersPage.tsx";
import AuthGuard from "./components/AuthGuard.tsx";
import OverviewPage from "./pages/OverviewPage.tsx";
import SavingsPage from "./pages/SavingsPage.tsx";
import IncomePage from "./pages/IncomePage.tsx";
import ExpensesPage from "./pages/ExpensesPage.tsx";
import TransfersPage from "./pages/TransfersPage.tsx";
import AccountsPage from "./pages/AccountsPage.tsx";
import CategoriesPage from "./pages/CategoriesPage.tsx";
import PersonsPage from "./pages/PersonsPage.tsx";
import ContractsPage from "./pages/ContractsPage.tsx";
import ClosingPage from "./pages/ClosingPage.tsx";

const router = createHashRouter([
    {
        path: '/login',
        element: <LoginPage/>,
    },
    {
        path: '/change-password',
        element: <ChangePasswordPage/>,
    },
    {
        path: '/',
        element: <AuthGuard><MainLayout/></AuthGuard>,
        children: [
            {
                errorElement: <ErrorPage/>,
                children: [
                    {path: '/', element: <OverviewPage/>, loader: contractsLoader},
                    {path: '/income', element: <IncomePage/>, loader: contractsLoader},
                    {path: '/expenses', element: <ExpensesPage/>, loader: contractsLoader},
                    {path: '/transfers', element: <TransfersPage/>, loader: contractsLoader},
                    {path: '/contracts', element: <ContractsPage/>, loader: contractsLoader},
                    {path: '/closing', element: <ClosingPage/>, loader: contractsLoader},
                    {path: '/savings', element: <SavingsPage/>, loader: contractsLoader},
                    {path: '/accounts', element: <AccountsPage/>, loader: contractsLoader},
                    {path: '/categories', element: <CategoriesPage/>, loader: contractsLoader},
                    {path: '/persons', element: <PersonsPage/>, loader: contractsLoader},
                    {path: '/entries', element: <Navigate to="/expenses" replace/>},
                    {path: '/household', element: <Navigate to="/accounts" replace/>},
                    {path: '/settings', element: <SettingsPage/>},
                    {path: '/users', element: <UsersPage/>},
                    {path: '/contracts/add', element: <ContractFormPage mode="add"/>, loader: contractFormLoader, action: contractAction},
                    {path: '/contracts/:id', element: <ContractPage/>, loader: contractLoader},
                    {path: '/contracts/:id/edit', element: <ContractFormPage mode="edit"/>, loader: contractLoader, action: contractAction},
                ],
            },
        ],
    },
]);

function App() {
    const {init} = usePreferences();

    useEffect(() => {
        init();
    }, [init])

    return <RouterProvider router={router}/>;
}

export default App
