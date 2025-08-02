import { Routes, Route, Link } from 'react-router-dom';

function Home() {
    return <h1 className="text-3xl font-bold underline text-blue-500"> Hello world! </h1>;
}

function About() {
    return <h2>About Page</h2>;
}

function App() {
    return (
        <div>
            <nav>
                <Link to="/">Home</Link> | <Link to="/about">About</Link>
            </nav>

            <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/about" element={<About />} />
                {/* Add more routes here */}
            </Routes>
        </div>
    );
}

export default App
