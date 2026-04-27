import Link from 'next/link'

export default function SiteFooter() {
  return (
    <>
      <footer className="vk-footer">
        <div>
          <p className="vk-footer-brand">Vital Kauaʻi</p>
          <p className="vk-footer-tagline">
            A living sanctuary of transformation and awakening on Kauaʻi&apos;s North Shore.
          </p>
          <p className="vk-footer-address">PO Box 932, Hanalei, HI 96714{'\n'}aloha@vitalkauai.com</p>
        </div>
        <div className="vk-footer-col">
          <h4>Explore</h4>
          <ul className="vk-footer-links">
            <li><Link href="/iboga-journey">The Iboga Journey</Link></li>
            <li><Link href="/about">Josh &amp; Rachel</Link></li>
            <li><Link href="/healing-circle">Our Healing Circle</Link></li>
            <li><Link href="/stay">Stay With Us</Link></li>
          </ul>
        </div>
        <div className="vk-footer-col">
          <h4>Connect</h4>
          <ul className="vk-footer-links">
            <li><Link href="/begin-your-journey">Begin the Journey</Link></li>
            <li><Link href="/portal">Member Portal</Link></li>
          </ul>
        </div>
        <div className="vk-footer-col">
          <h4>Our Policies</h4>
          <ul className="vk-footer-links">
            <li><Link href="/privacy-policy">Privacy Policy</Link></li>
            <li><Link href="/terms-of-use">Terms of Use</Link></li>
            <li><Link href="/medical-disclaimer">Medical Disclaimer</Link></li>
            <li><Link href="/church-information">Church Information</Link></li>
          </ul>
        </div>
      </footer>

      <div className="vk-footer-bottom">
        <p>
          © 2026 Vital Kauaʻi Church · All original content on this site is protected by U.S.
          copyright law. Reproduction without written permission prohibited.
        </p>
      </div>

      <style>{`
        .vk-footer {
          display: grid;
          grid-template-columns: 1.5fr 1fr 1fr 1fr;
          gap: 60px;
          padding: 60px;
          background: #0B140C;
          border-top: 1px solid rgb(200 169 110 / 0.1);
        }
        .vk-footer-brand {
          margin: 0 0 16px;
          font-family: 'Cormorant Garamond', Georgia, serif;
          font-size: 24px;
          font-weight: 300;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          color: #F5F0E8;
        }
        .vk-footer-tagline {
          max-width: 240px;
          margin: 0;
          font-size: 12px;
          line-height: 1.8;
          color: rgb(245 240 232 / 0.4);
        }
        .vk-footer-address {
          margin-top: 12px;
          font-size: 12px;
          line-height: 1.9;
          color: rgb(245 240 232 / 0.4);
          white-space: pre-line;
        }
        .vk-footer-col h4 {
          margin: 0 0 24px;
          font-size: 10px;
          letter-spacing: 0.3em;
          text-transform: uppercase;
          color: #C8A96E;
          font-weight: 600;
        }
        .vk-footer-links {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin: 0;
          padding: 0;
          list-style: none;
        }
        .vk-footer-links a {
          font-size: 13px;
          color: rgb(245 240 232 / 0.5);
          text-decoration: none;
          transition: color 0.3s;
        }
        .vk-footer-links a:hover {
          color: #F5F0E8;
        }
        .vk-footer-bottom {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px 60px;
          background: #0B140C;
          border-top: 1px solid rgb(255 255 255 / 0.05);
          text-align: center;
        }
        .vk-footer-bottom p {
          margin: 0;
          font-size: 11px;
          color: rgb(245 240 232 / 0.3);
          line-height: 1.7;
        }
        @media (max-width: 880px) {
          .vk-footer {
            grid-template-columns: 1fr 1fr;
            gap: 40px;
            padding: 48px 28px;
          }
          .vk-footer-bottom {
            padding: 20px 28px;
          }
        }
        @media (max-width: 520px) {
          .vk-footer {
            grid-template-columns: 1fr;
            gap: 36px;
          }
        }
      `}</style>
    </>
  )
}
