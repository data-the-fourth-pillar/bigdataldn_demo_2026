import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useChatStore } from '../store/chatStore';
import type { PersonaLens } from '../types/chat';
import mdsShoeLight from '../assets/mds_shoe_light.jpg';
import mdsShoeDark from '../assets/mds_shoe_dark.jpg';
import './HomePage.css';

interface PersonaCard {
    lens: PersonaLens;
    icon: string;
    accent: 'purple' | 'emerald' | 'cyan';
    title: string;
}

const PERSONA_CARDS: PersonaCard[] = [
    { lens: 'ceo', icon: '👔', accent: 'purple', title: '1. CEO' },
    { lens: 'vp_supply_chain', icon: '🚚', accent: 'emerald', title: '2. VP Supply Chain' },
    { lens: 'cdo', icon: '🛡️', accent: 'cyan', title: '3. CDO' },
];

export const HomePage: React.FC = () => {
    const navigate = useNavigate();
    const setPersonaLens = useChatStore(state => state.setPersonaLens);

    const handlePersonaClick = (lens: PersonaLens) => {
        setPersonaLens(lens);
        navigate('/chat');
    };

    return (
        <div className="home-page">
            <div className="home-page-inner">
                <section className="home-hero">
                    <div className="home-hero-text">
                        <span className="home-eyebrow">Enterprise Context in Action</span>
                        <h1>Meet MDS - My Dream Shoe</h1>
                        <p className="home-hero-sub">
                            My Dream Shoe — the case study behind this demo.
                            <br />
                            MDS is expanding from Wholesale into Direct-to-Consumer.
                            <br />
                            Every persona needs the same shared context to make this launch successful.
                        </p>
                        <div className="home-hero-actions">
                            <button type="button" className="home-cta-primary" onClick={() => navigate('/graph')}>
                                Explore the Graph
                            </button>
                            <button type="button" className="home-cta-secondary" onClick={() => navigate('/chat')}>
                                Ask a Question
                            </button>
                        </div>
                    </div>
                    <div className="home-hero-image">
                        <img src={mdsShoeLight} alt="MDS — My Dream Shoe" className="shoe-image shoe-image-light" />
                        <img src={mdsShoeDark} alt="MDS — My Dream Shoe" className="shoe-image shoe-image-dark" />
                    </div>
                </section>

                <section className="home-personas">
                    <span className="home-eyebrow">Executive Stakeholder Views</span>
                    <h2>One Shared Context, Three Executive Lenses</h2>
                    <p className="home-personas-sub">
                        The same enterprise knowledge graph powers tailored operational views across the C-suite.
                    </p>
                    <div className="persona-cards">
                        {PERSONA_CARDS.map((card) => (
                            <button
                                key={card.lens}
                                type="button"
                                className={`persona-card persona-card-${card.accent}`}
                                onClick={() => handlePersonaClick(card.lens)}
                            >
                                <span className="persona-card-icon">{card.icon}</span>
                                <h3>{card.title}</h3>
                            </button>
                        ))}
                    </div>
                </section>
            </div>
        </div>
    );
};
