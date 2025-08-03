import {createHashRouter, createRoutesFromElements, Route, RouterProvider} from "react-router";
import MainLayout from "./layouts/MainLayout.tsx";
import HomePage from "./pages/HomePage.tsx";
import AboutPage from "./pages/AboutPage.tsx";
import ErrorPage from "./pages/ErrorPage.tsx";

const router = createHashRouter(
    createRoutesFromElements(
        <>
            <Route path="/" element={<MainLayout/>} errorElement={<ErrorPage/>}>
                <Route path="/" element={<HomePage/>}/>
                <Route path="/about" element={<AboutPage/>}/>
            </Route>
        </>
    )
);

function App() {
    return <RouterProvider router={router} />;
}

export default App
