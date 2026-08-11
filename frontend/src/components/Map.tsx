import {
    MapContainer,
    TileLayer
} from 'react-leaflet';

import 'leaflet/dist/leaflet.css';

function Map() {
    return (
        <MapContainer
            className="map"
            center={[51.5074, -0.1278]}
            zoom={13}
        >
            <TileLayer
                attribution="&copy; OpenStreetMap contributors"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
        </MapContainer>
    );
}

export default Map;