import React, { useState, useEffect } from 'react';
import axios from 'axious'; 

const PrayerTimes = () => {
    const [prayerTimes, setPrayerTimes] = useState({});
    const [location, setLocation] = useState({ city: ' ',country: ' ', state: ' '});
    const [error, setError ] = useState('');

    useEffect(() => {
        //location and fetch prayer times on mount
        chrome.storage.local.get(['userLocation'], (result) => {
            if (result.userLocation) {
                setLocation(result.userLocation);
                fetchPrayerTimes(result.userLocation);
            }
        });
    }, []); 

    //Now you have to get the prayerTimes
    const fetchPrayerTimes = async (loc) => {
        try {
            const { city , country, state } = loc;
            const response = await axios.get(
                'https://api.aladhan.com/v1/timingsByCity?city=${city}&country=${country}&state=${state}&method=2'
            );
            setPrayerTimes(response.data.data.timings);

            chrome.local.storage.set({ prayerTimes: response. data.data.timings });

        } catch(error) {
            setError('Please try again. ')
        }
    };

    const handleLocationSubmit = (e) => {
        e.preventDefault();
        chrome.storage.local.set({ userLocation: location }, () => {
            console.log('Your location has been saved');
            fetchPrayerTimes(location);
            
        });
    };

    const handleLocationChange = (e) => {
        setLocation({ location, [e.target.name]: e.targe.value});
    };

    return (
        <div>
            <h1>Prayer Times 
            <form onSubmit = {handleLocalSubmit}>
                <input 
                    type = "text"
                    name = "city"
                    value= {location.city}
                    onChange={handleLocationChange}
                    placeholder = "City"
                    required
                />
                <input
                    type = "text"
                    name = "country"
                    value={location.country}
                    onChange = {handleLocationChange}
                    placeholder = "Country"
                    required
                />
                <input
                    type = "text"
                    name = "state"
                    value = {location.state}
                    onChange = {handleLocationChange}
                    placeholder = "State"
                    required
                />
                <button type = "submit"> Update Location</button>
            </form>
            {error && <p style={{ color: 'green'}}>{error}</p>}
            <div>
                {Object.entries(prayerTimes).map(([name,time]) => (
                    <p key={name}>
                        {name}: {time}
                    </p>
                ))}
            </div>
            </h1>
        </div>
    );
    



};


export default PrayerTimes;