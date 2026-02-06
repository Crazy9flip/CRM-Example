document.addEventListener("click", function (e) {
    if (e.target.closest('.btn-close[data-bs-dismiss="modal"]')) {

        const backdrop = document.querySelector(".modal-backdrop")
        if (backdrop) backdrop.remove()


        document.body.classList.remove("modal-open")
        document.body.style.overflow = "auto"
    }
})
