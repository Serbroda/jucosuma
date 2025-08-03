import {createHashRouter, RouterProvider} from "react-router";
import MainLayout from "./layouts/MainLayout.tsx";
import HomePage from "./pages/HomePage.tsx";
import SettingsPage from "./pages/SettingsPage.tsx";
import ErrorPage from "./pages/ErrorPage.tsx";
import PersonsPage from "./pages/PersonsPage.tsx";
import {usePreferences} from "./stores/usePreferences.ts";
import {useEffect} from "react";
import ContractPage from "./pages/ContractPage.tsx";
import {contractLoader, contractsLoader} from "./loader/contracts.ts";
import {contractAction} from "./actions/contracts.ts";

const router = createHashRouter([
    {
        path: '/',
        element: <MainLayout/>,
        children: [
            {
                errorElement: <ErrorPage/>,
                children: [
                    {path: '/', element: <HomePage/>, loader: contractsLoader},
                    {path: '/persons', element: <PersonsPage/>},
                    {path: '/settings', element: <SettingsPage/>},
                    {path: '/contracts/add', element: <ContractPage mode="add"/>, action: contractAction},
                    {path: '/contracts/:id', element: <ContractPage mode="edit"/>, loader: contractLoader, action: contractAction},
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
