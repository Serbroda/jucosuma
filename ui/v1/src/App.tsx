import {createHashRouter, createRoutesFromElements, Route, RouterProvider} from "react-router";
import MainLayout from "./layouts/MainLayout.tsx";
import HomePage from "./pages/HomePage.tsx";
import SettingsPage from "./pages/SettingsPage.tsx";
import ErrorPage from "./pages/ErrorPage.tsx";
import PersonsPage from "./pages/PersonsPage.tsx";
import {usePreferences} from "./stores/usePreferences.ts";
import {useEffect} from "react";
import ContractPage from "./pages/ContractPage.tsx";

const router = createHashRouter(
    createRoutesFromElements(
        <>
            <Route path="/" element={<MainLayout/>} errorElement={<ErrorPage/>}>
                <Route path="/" element={<HomePage/>}/>
                <Route path="/persons" element={<PersonsPage/>}/>
                <Route path="/settings" element={<SettingsPage/>}/>
                <Route path="/contracts/:id" element={<ContractPage/>}/>
            </Route>
        </>
    )
);

function App() {
    const {init} = usePreferences();

    useEffect(() => {
        init();
    }, [init])

    return <RouterProvider router={router}/>;
}

export default App
