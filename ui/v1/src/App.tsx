import {createHashRouter, RouterProvider} from "react-router";
import MainLayout from "./layouts/MainLayout.tsx";
import HomePage from "./pages/HomePage.tsx";
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
import HouseholdPage from "./pages/HouseholdPage.tsx";
import SavingsPage from "./pages/SavingsPage.tsx";

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
                    {path: '/entries', element: <HomePage/>, loader: contractsLoader},
                    {path: '/savings', element: <SavingsPage/>, loader: contractsLoader},
                    {path: '/household', element: <HouseholdPage/>},
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
