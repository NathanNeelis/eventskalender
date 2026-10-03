import logo from "../assets/logo.png";
import classes from "./footer.module.css";

export default function Footer() {
  return (
    <footer className={classes.footer}>
      <img src={logo} alt="logo mdsc" className={classes.logo} />
    </footer>
  );
}
