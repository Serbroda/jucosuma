import {Link, Route, Routes} from 'react-router-dom';
import {BeakerIcon} from "@heroicons/react/16/solid";
import {Button} from "@headlessui/react";

function Home() {
    return (
        <>
            <h1 className="text-3xl font-bold underline text-blue-500"> Hello world! </h1>
            <Button className="inline-flex items-center gap-2 rounded-md bg-gray-700 px-3 py-1.5 text-sm/6 font-semibold text-white shadow-inner shadow-white/10 focus:not-data-focus:outline-none data-focus:outline data-focus:outline-white data-hover:bg-gray-600 data-open:bg-gray-700">
                Save changes
            </Button>
        </>
    );
}

function About() {
    return (
        <>
            <h2>About Page</h2>
            <BeakerIcon className="size-6 text-blue-500"/>
        </>
    );
}

function App() {
    return (
        <div>
            <nav>
                <Link to="/">Home</Link> | <Link to="/about">About</Link>
            </nav>

            <Routes>
                <Route path="/" element={<Home/>}/>
                <Route path="/about" element={<About/>}/>
                {/* Add more routes here */}
            </Routes>
        </div>
    );
}

export default App
