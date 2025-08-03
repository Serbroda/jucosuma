import {createHashRouter, RouterProvider} from "react-router";
import MainLayout from "./layouts/MainLayout.tsx";
import HomePage from "./pages/HomePage.tsx";
import SettingsPage from "./pages/SettingsPage.tsx";
import ErrorPage from "./pages/ErrorPage.tsx";
import PersonsPage from "./pages/PersonsPage.tsx";
import {usePreferences} from "./stores/usePreferences.ts";
import {useEffect} from "react";
import ContractPage from "./pages/ContractPage.tsx";
import {apiBasePath} from "./config.ts";

const router = createHashRouter([
    {
        path: '/',
        element: <MainLayout/>,
        children: [
            {
                errorElement: <ErrorPage/>,
                children: [
                    {path: '/', element: <HomePage/>},
                    {path: '/persons', element: <PersonsPage/>},
                    {path: '/settings', element: <SettingsPage/>},
                    {
                        path: '/contracts/:id',
                        element: <ContractPage/>,
                        loader: async ({params}) => {
                            const res = await fetch(`${apiBasePath}/contracts/${params.id}`);
                            if (!res.ok) {
                                throw new Response(res.statusText, {status: res.status});
                            }

                            const contract = await res.json();
                            if (!contract) {
                                throw new Response("Not Found", {status: 404});
                            }
                            return {contract: contract};
                        }
                    },
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
